/** How an experience wants to be presented. */
export type ExperienceMode = 'vr' | 'mixed-reality';

export type XRSupport = { vr: boolean; ar: boolean };

export type ResolvedXRMode =
  | {
      mode: ExperienceMode;
      session: 'immersive-vr' | 'immersive-ar';
      background: 'opaque' | 'passthrough';
      fallbackReason?: string;
    }
  | { mode: null; reason: string };

const VR = { mode: 'vr', session: 'immersive-vr', background: 'opaque' } as const;
const MR = { mode: 'mixed-reality', session: 'immersive-ar', background: 'passthrough' } as const;

/** Pick the session to request for a mode, falling back when the device lacks support. */
export const resolveXRMode = (requested: ExperienceMode, support: XRSupport): ResolvedXRMode => {
  if (requested === 'mixed-reality') {
    if (support.ar) return { ...MR };
    if (support.vr) {
      return { ...VR, fallbackReason: 'Passthrough (immersive-ar) is not supported on this device; using VR.' };
    }
  } else {
    if (support.vr) return { ...VR };
    if (support.ar) {
      return { ...MR, fallbackReason: 'Immersive VR is not supported on this device; using mixed reality.' };
    }
  }
  return { mode: null, reason: 'WebXR immersive sessions are not available in this browser.' };
};
