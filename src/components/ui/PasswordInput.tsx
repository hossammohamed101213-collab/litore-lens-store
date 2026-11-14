"use client";

import { useState } from "react";

/** Password box with an eye button that shows/hides what was typed (works inside plain server-action forms). */
export function PasswordInput({ id, name, className, labels = { show: "إظهار كلمة المرور", hide: "إخفاء كلمة المرور" }, ...rest }:
  { labels?: { show: string; hide: string } } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} dir="ltr" className={`${className ?? ""} pr-12`} {...rest} />
      <button type="button" onClick={() => setShow((x) => !x)} aria-label={show ? labels.hide : labels.show} aria-pressed={show}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full hover:bg-blush/40">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{!show && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
