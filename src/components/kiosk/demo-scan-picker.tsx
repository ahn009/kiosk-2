"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CreditCard, Search, ArrowRight, KeyRound } from "lucide-react";
import { motion } from "framer-motion";

export type DemoCard = {
  employeeId: string;
  code: string;
  name: string;
  designation: string | null;
  token: string;
};

export function DemoScanPicker({
  open,
  onOpenChange,
  cards,
  loading,
  onPick,
  onRawToken,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cards: DemoCard[];
  loading: boolean;
  onPick: (card: DemoCard) => void;
  onRawToken: (token: string) => void;
}) {
  const [q, setQ] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState("");

  const filtered = q
    ? cards.filter(
        (c) =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.code.toLowerCase().includes(q.toLowerCase()),
      )
    : cards;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/60 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="size-5 text-primary" />
            Simulate ID card scan
          </DialogTitle>
          <DialogDescription>
            Demo helper — picks a real issued card token (minted freshly on each
            load) and feeds it through the kiosk verification pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or code…"
              className="pl-9"
            />
          </div>
          <Button
            variant={rawMode ? "default" : "outline"}
            size="sm"
            onClick={() => setRawMode((v) => !v)}
            className="gap-1.5"
          >
            <KeyRound className="size-3.5" /> Raw token
          </Button>
        </div>

        {rawMode ? (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste a raw QR token (format{" "}
              <code className="font-mono text-[10px] bg-muted px-1 rounded">
                v2.org.key.nonce.exp.sig
              </code>
              ) to drive a real scan.
            </p>
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="v2.ACME.k1.…"
              className="font-mono text-xs"
            />
            <Button
              disabled={!raw.trim()}
              onClick={() => onRawToken(raw.trim())}
              className="w-full gap-2"
            >
              Run verification
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" /> Minting demo tokens…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No demo cards available. Check that enrolled employees exist.
          </p>
        ) : (
          <ScrollArea className="h-[420px] -mx-2 pr-2">
            <div className="flex flex-col gap-2 px-2">
              {filtered.map((c, idx) => (
                <motion.button
                  key={c.employeeId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.02 }}
                  onClick={() => onPick(c)}
                  className="group text-left"
                >
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background hover:border-primary/40 hover:bg-accent/30 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-mono text-xs uppercase">
                        {c.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.designation ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {c.code}
                      </Badge>
                      <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
