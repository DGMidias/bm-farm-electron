import type { DesktopApi } from "../preload";

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export {};
