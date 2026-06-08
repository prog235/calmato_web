import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export type AmbientChannelId = "city" | "rain" | "forest" | "wave" | "fire" | "space";
export type AmbientVolumeId = "all" | AmbientChannelId;

export type AmbientChannel = {
  id: AmbientChannelId;
  label: string;
  color: string;
  audioPath?: string;
};

type AudioNodeBundle = {
  audio: HTMLAudioElement;
  gain: GainNode;
  fadeTimer: number | null;
};

const FADE_SECONDS = 0.7;
const DEFAULT_MASTER_VOLUME = 0.72;
const DEFAULT_CHANNEL_VOLUME = 0.62;

// audioPath is a path inside the Supabase "assets" bucket.
export const AMBIENT_CHANNELS: AmbientChannel[] = [
  { id: "city", label: "City", color: "from-sky-500/70 via-indigo-500/45 to-black" },
  { id: "rain", label: "Rain", color: "from-amber-300/55 via-blue-500/35 to-black" },
  { id: "forest", label: "Forest", color: "from-emerald-600/55 via-lime-700/35 to-black" },
  { id: "wave", label: "Wave", color: "from-cyan-400/65 via-blue-700/40 to-black" },
  { id: "fire", label: "Fire", color: "from-orange-500/60 via-red-900/35 to-black" },
  { id: "space", label: "Space", color: "from-slate-300/55 via-blue-900/35 to-black" },
];

export function getAmbientAssetUrl(path?: string | null) {
  if (!path) return null;

  const { data } = supabase.storage
    .from("assets")
    .getPublicUrl(path);

  return data.publicUrl;
}

function buildAmbientAudioUrl(channel: AmbientChannel) {
  return getAmbientAssetUrl(channel.audioPath ?? `ambient_mixer/${channel.id}.mp3`) ?? "";
}

export function buildAmbientImageUrl(channel: AmbientChannel) {
  return getAmbientAssetUrl(`ambient_mixer/${channel.id}.jpg`);
}

function makeDefaultVolumes() {
  return {
    all: DEFAULT_MASTER_VOLUME,
    city: DEFAULT_CHANNEL_VOLUME,
    rain: DEFAULT_CHANNEL_VOLUME,
    forest: DEFAULT_CHANNEL_VOLUME,
    wave: DEFAULT_CHANNEL_VOLUME,
    fire: DEFAULT_CHANNEL_VOLUME,
    space: DEFAULT_CHANNEL_VOLUME,
  } satisfies Record<AmbientVolumeId, number>;
}

function makeDefaultPlaying() {
  return {
    city: false,
    rain: false,
    forest: false,
    wave: false,
    fire: false,
    space: false,
  } satisfies Record<AmbientChannelId, boolean>;
}

function rampGain(gain: GainNode, value: number, seconds = FADE_SECONDS) {
  const now = gain.context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(value, now + seconds);
}

export function useAmbientMixer() {
  const [volumes, setVolumes] = useState<Record<AmbientVolumeId, number>>(makeDefaultVolumes);
  const [playing, setPlaying] = useState<Record<AmbientChannelId, boolean>>(makeDefaultPlaying);
  const [ready, setReady] = useState(false);

  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const bundlesRef = useRef<Partial<Record<AmbientChannelId, AudioNodeBundle>>>({});
  const volumesRef = useRef(volumes);
  const playingRef = useRef(playing);

  useEffect(() => {
    volumesRef.current = volumes;
  }, [volumes]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const ensureAudioGraph = useCallback(async () => {
    if (typeof window === "undefined") return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!contextRef.current) {
      const context = new AudioContextClass();
      const masterGain = context.createGain();
      masterGain.gain.value = volumesRef.current.all;
      masterGain.connect(context.destination);

      contextRef.current = context;
      masterGainRef.current = masterGain;

      AMBIENT_CHANNELS.forEach((channel) => {
        const audio = new Audio();
        const url = buildAmbientAudioUrl(channel);
        audio.loop = true;
        audio.preload = "auto";
        audio.crossOrigin = "anonymous";
        audio.src = url;
        audio.load();
        console.info(`[AmbientMixer] ${channel.id} source:`, url);
        audio.addEventListener("error", () => {
          console.warn(
            `[AmbientMixer] Failed to load ${channel.id}.`,
            audio.error?.code,
            audio.error?.message,
            url
          );
        });

        const source = context.createMediaElementSource(audio);
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(masterGain);

        bundlesRef.current[channel.id] = {
          audio,
          gain,
          fadeTimer: null,
        };
      });

      setReady(true);
    }

    if (contextRef.current.state === "suspended") {
      await contextRef.current.resume();
    }

    return contextRef.current;
  }, []);

  const playChannel = useCallback(
    async (channelId: AmbientChannelId) => {
      await ensureAudioGraph();

      const bundle = bundlesRef.current[channelId];
      if (!bundle) return;

      if (bundle.fadeTimer) {
        window.clearTimeout(bundle.fadeTimer);
        bundle.fadeTimer = null;
      }

      try {
        await bundle.audio.play();
        rampGain(bundle.gain, volumesRef.current[channelId]);
        setPlaying((prev) => ({ ...prev, [channelId]: true }));
      } catch (error) {
        console.warn(`[AmbientMixer] Failed to play ${channelId}.`, {
          error,
          src: bundle.audio.src,
          currentSrc: bundle.audio.currentSrc,
          networkState: bundle.audio.networkState,
          readyState: bundle.audio.readyState,
          mediaErrorCode: bundle.audio.error?.code,
          mediaErrorMessage: bundle.audio.error?.message,
        });
        setPlaying((prev) => ({ ...prev, [channelId]: false }));
      }
    },
    [ensureAudioGraph]
  );

  const pauseChannel = useCallback(async (channelId: AmbientChannelId) => {
    await ensureAudioGraph();

    const bundle = bundlesRef.current[channelId];
    if (!bundle) return;

    rampGain(bundle.gain, 0);

    if (bundle.fadeTimer) {
      window.clearTimeout(bundle.fadeTimer);
    }

    bundle.fadeTimer = window.setTimeout(() => {
      bundle.audio.pause();
      bundle.fadeTimer = null;
    }, FADE_SECONDS * 1000);

    setPlaying((prev) => ({ ...prev, [channelId]: false }));
  }, [ensureAudioGraph]);

  const toggleChannel = useCallback(
    async (channelId: AmbientChannelId) => {
      if (playingRef.current[channelId]) {
        await pauseChannel(channelId);
      } else {
        await playChannel(channelId);
      }
    },
    [pauseChannel, playChannel]
  );

  const setVolume = useCallback((id: AmbientVolumeId, value: number) => {
    const nextValue = Math.min(1, Math.max(0, value));

    setVolumes((prev) => ({ ...prev, [id]: nextValue }));

    if (id === "all") {
      const masterGain = masterGainRef.current;
      if (masterGain) rampGain(masterGain, nextValue, 0.18);
      return;
    }

    const bundle = bundlesRef.current[id];
    if (bundle) {
      rampGain(bundle.gain, playingRef.current[id] ? nextValue : 0, 0.18);
    }
  }, []);

  const anyPlaying = useMemo(
    () => AMBIENT_CHANNELS.some((channel) => playing[channel.id]),
    [playing]
  );

  const toggleAll = useCallback(async () => {
    await ensureAudioGraph();

    if (AMBIENT_CHANNELS.some((channel) => playingRef.current[channel.id])) {
      await Promise.all(AMBIENT_CHANNELS.map((channel) => pauseChannel(channel.id)));
    } else {
      await Promise.all(AMBIENT_CHANNELS.map((channel) => playChannel(channel.id)));
    }
  }, [ensureAudioGraph, pauseChannel, playChannel]);

  useEffect(() => {
    return () => {
      Object.values(bundlesRef.current).forEach((bundle) => {
        if (!bundle) return;
        if (bundle.fadeTimer) window.clearTimeout(bundle.fadeTimer);
        bundle.audio.pause();
        bundle.audio.src = "";
      });

      void contextRef.current?.close();
      contextRef.current = null;
      masterGainRef.current = null;
      bundlesRef.current = {};
    };
  }, []);

  return {
    channels: AMBIENT_CHANNELS,
    volumes,
    playing,
    anyPlaying,
    ready,
    setVolume,
    toggleAll,
    toggleChannel,
    resume: ensureAudioGraph,
  };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
