export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
  [key: string]: string;
}

export function generateIconSvg(size: number): string;
export function resolveManifestIcons(sizes: number[], hasPng: (size: number) => boolean): ManifestIcon[];
export function injectIconsIntoManifest(manifest: Record<string, unknown>, icons: ManifestIcon[] | unknown[]): Record<string, unknown>;
export function hashFile(filePath: string): string;
export function injectSwVersion(swContent: string, version: string): string;
export function writeIcons(sizes: number[], srcIconsDir: string, distIconsDir: string): void;
