"use client";
/**
 * Which optional files exist in /public is resolved on the server
 * (app/page.tsx) and handed to the client, so we never request a 404.
 */
import { createContext, useContext, useEffect, useState } from "react";
import * as THREE from "three";

export const AssetsContext = createContext<string[]>([]);

export function useHasAsset(url: string) {
  return useContext(AssetsContext).includes(url);
}

type ImageTexture = THREE.Texture<HTMLImageElement>;
const cache = new Map<string, Promise<ImageTexture>>();

/** Returns the texture when the file was provided, otherwise null (→ procedural fallback). */
export function useOptionalTexture(url: string, srgb = true): ImageTexture | null {
  const has = useHasAsset(url);
  const [tex, setTex] = useState<ImageTexture | null>(null);
  useEffect(() => {
    if (!has) return;
    let alive = true;
    if (!cache.has(url)) cache.set(url, new THREE.TextureLoader().loadAsync(url) as Promise<ImageTexture>);
    cache.get(url)!.then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      if (alive) setTex(t);
    });
    return () => {
      alive = false;
    };
  }, [has, url, srgb]);
  return tex;
}
