import { useId, useMemo } from 'react';
import { toQR } from 'toqr';

/** A local QR matrix renderer; the pairing capability is never sent to an image service. */
export function PairingQrCode({ value }: { value: string }) {
  const titleId = useId();
  const { width, path } = useMemo(() => {
    const matrix = toQR(value, 0); // Medium error correction.
    const size = Math.sqrt(matrix.length);
    if (!Number.isInteger(size)) throw new Error('Could not create the QR code.');
    const modules: string[] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (matrix[y * size + x]) modules.push(`M${x + 4},${y + 4}h1v1h-1z`);
    }
    return { width: size + 8, path: modules.join('') };
  }, [value]);
  return <svg role="img" aria-labelledby={titleId} width={210} height={210} viewBox={`0 0 ${width} ${width}`} shapeRendering="crispEdges"><title id={titleId}>Scan with Expense Tracker to pair this browser</title><rect width={width} height={width} fill="#ffffff" /><path d={path} fill="#111111" /></svg>;
}
