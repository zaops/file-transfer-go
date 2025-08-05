"use client";

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
  title?: string;
}

export default function QRCodeDisplay({ 
  value, 
  size = 200, 
  className = "",
  title = "扫码传输"
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const generateQR = async () => {
      try {
        if (canvasRef.current && value) {
          await QRCode.toCanvas(canvasRef.current, value, {
            width: size,
            margin: 2,
            color: {
              dark: '#1e293b', // slate-800
              light: '#ffffff'
            }
          });
          setError('');
        }
      } catch (err) {
        console.error('生成二维码失败:', err);
        setError('生成二维码失败');
      }
    };

    generateQR();
  }, [value, size]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-lg ${className}`} 
           style={{ width: size, height: size }}>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && (
        <h3 className="text-sm font-medium text-slate-700 text-center mb-3">{title}</h3>
      )}
      <div className="flex justify-center">
        <canvas 
          ref={canvasRef}
          className="rounded-lg"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
    </div>
  );
}
