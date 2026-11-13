/** IWSDK does not currently expose light-estimation in its structured feature flags. */
export const withLightEstimation = (init: XRSessionInit = {}): XRSessionInit => ({
  ...init,
  optionalFeatures: [...new Set([...(init.optionalFeatures ?? []), 'light-estimation'])],
});

let installed = false;
export const isLightEstimationOptInActive = () => installed;

/** Append the optional feature to sessions created by IWSDK. Unknown optional features are ignored. */
export const installLightEstimationOptIn = (): boolean => {
  if (installed) return true;
  const xr = navigator.xr;
  if (!xr) return false;
  try {
    const original = xr.requestSession.bind(xr);
    xr.requestSession = ((mode: XRSessionMode, init?: XRSessionInit) =>
      original(mode, withLightEstimation(init))) as XRSystem['requestSession'];
    const offered = xr as XRSystem & { offerSession?: (mode: XRSessionMode, init?: XRSessionInit) => Promise<XRSession> };
    if (offered.offerSession) {
      const offer = offered.offerSession.bind(xr);
      offered.offerSession = (mode: XRSessionMode, init?: XRSessionInit) => offer(mode, withLightEstimation(init));
    }
    installed = true;
    return true;
  } catch {
    return false;
  }
};
