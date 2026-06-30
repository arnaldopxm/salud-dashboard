export declare function generateIconSvg(size: number): string;
export declare function resolveManifestIcons(
  sizes: number[],
  hasPng: (size: number) => boolean,
): Array<{ src: string; sizes: string; type: string; purpose: string }>;
export declare function injectIconsIntoManifest(
  manifest: Record<string, unknown>,
  icons: unknown[],
): Record<string, unknown>;
export declare function hashFile(filePath: string): string;
export declare function injectSwVersion(swContent: string, version: string): string;
export declare function writeIcons(sizes: number[], srcIconsDir: string, distIconsDir: string): void;
