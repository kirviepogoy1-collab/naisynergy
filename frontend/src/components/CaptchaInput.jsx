import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { RefreshCw } from 'lucide-react';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

function randomCode(length = 5) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return code;
}

function drawCaptcha(canvas, code) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // background
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(0, 0, width, height);

    // noise lines
    for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(21, 128, 61, ${0.15 + Math.random() * 0.25})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
    }

    // characters, each rotated/offset a bit
    const charWidth = width / code.length;
    for (let i = 0; i < code.length; i++) {
        const x = charWidth * i + charWidth / 2;
        const y = height / 2 + (Math.random() * 10 - 5);
        const angle = (Math.random() * 30 - 15) * (Math.PI / 180);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.font = 'bold 26px monospace';
        ctx.fillStyle = `hsl(${140 + Math.random() * 20}, 55%, ${25 + Math.random() * 15}%)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code[i], 0, 0);
        ctx.restore();
    }

    // noise dots
    for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(21, 128, 61, ${0.2 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Exposes isValid() so parent forms can do a final check on submit.
const CaptchaInput = forwardRef(function CaptchaInput({ value, onChange }, ref) {
    const [code, setCode] = useState(() => randomCode());
    const canvasRef = useRef(null);

    function refresh() {
        setCode(randomCode());
        onChange('');
    }

    useEffect(() => {
        if (canvasRef.current) drawCaptcha(canvasRef.current, code);
    }, [code]);

    useImperativeHandle(ref, () => ({
        isValid: () => value.trim().toUpperCase() === code,
        refresh
    }));

    return (
        <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Enter the code shown</label>
            <div className="flex items-center gap-2 mb-2">
                <canvas ref={canvasRef} width={150} height={50} className="rounded-xl border border-gray-200 select-none" />
                <button
                    type="button"
                    onClick={refresh}
                    title="Get a new code"
                    className="p-2 rounded-xl bg-white hover:bg-gray-50 text-brand-700 border border-gray-200 min-h-[44px] min-w-[44px] flex items-center justify-center transition"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
            <input
                type="text"
                placeholder="Type the code above"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                autoComplete="off"
                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 tracking-widest uppercase transition"
            />
        </div>
    );
});

export default CaptchaInput;
