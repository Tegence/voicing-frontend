"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/Button";

interface HeaderProps {
  variant?: "landing" | "auth";
}

export default function Header({ variant = "landing" }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass border-b border-neutral-200/60">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
            <span className="text-xl font-semibold text-neutral-800">Voicing</span>
          </Link>

          {variant === "landing" && (
            <>
              <div className="flex items-center space-x-3">
                <Link href="/login" className="text-neutral-600 hover:text-neutral-900 transition-colors">Sign In</Link>
                <Link href="/register">
                  <Button variant="outline" size="sm" className="shadow-none hover:shadow-none">
                    Get Started
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}