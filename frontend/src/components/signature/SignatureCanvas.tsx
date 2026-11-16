import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { cn } from '@/lib/utils';

export interface SignatureCanvasHandle {
  clear: () => void;
  exportAsDataUrl: () => string | null;
  isEmpty: () => boolean;
}

interface SignatureCanvasProps {
  initialValue?: string;
  disabled?: boolean;
  className?: string;
  onChange?: (value: string | null) => void;
}

function toCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();
  const ratioX = canvas.width / rect.width;
  const ratioY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * ratioX,
    y: (event.clientY - rect.top) * ratioY,
  };
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas({ initialValue, disabled, className, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const hasStrokeRef = useRef(false);
    const [isReady, setIsReady] = useState(false);

    const redrawBackground = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 2.5;
      context.strokeStyle = '#1e293b';
    };

    const clear = () => {
      redrawBackground();
      hasStrokeRef.current = false;
      onChange?.(null);
    };

    const exportAsDataUrl = () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasStrokeRef.current) return null;
      return canvas.toDataURL('image/png');
    };

    useImperativeHandle(ref, () => ({
      clear,
      exportAsDataUrl,
      isEmpty: () => !hasStrokeRef.current,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      redrawBackground();
      setIsReady(true);
    }, []);

    useEffect(() => {
      if (!isReady || !initialValue) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const image = new Image();
      image.onload = () => {
        redrawBackground();
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        hasStrokeRef.current = true;
      };
      image.src = initialValue;
    }, [initialValue, isReady]);

    const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const point = toCanvasPoint(canvas, event);
      context.beginPath();
      context.moveTo(point.x, point.y);
      isDrawingRef.current = true;
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled || !isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const point = toCanvasPoint(canvas, event);
      context.lineTo(point.x, point.y);
      context.stroke();
      hasStrokeRef.current = true;
    };

    const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(event.pointerId);
      }
      isDrawingRef.current = false;
      onChange?.(exportAsDataUrl());
    };

    return (
      <canvas
        ref={canvasRef}
        width={960}
        height={260}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        className={cn(
          'h-44 w-full rounded-2xl border border-slate-300 bg-white touch-none',
          disabled && 'cursor-not-allowed opacity-70',
          className,
        )}
        style={{ touchAction: 'none' }}
      />
    );
  },
);

