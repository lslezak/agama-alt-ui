import { motion } from "framer-motion";

/** The animated emblem: a spinning gradient ring around a pulsing "A". */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <div className="logo" style={{ width: size, height: size }}>
      <div className="logo__ring" />
      <div className="logo__ring logo__ring--reverse" />
      <motion.div
        className="logo__core"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 12 }}
      >
        A
      </motion.div>
    </div>
  );
}

/** Title with letters flying in one by one. */
export function AnimatedTitle({ text }: { text: string }) {
  return (
    <h1 className="title" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={i}
          className="title__letter"
          initial={{ opacity: 0, y: 40, rotateX: -90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 200, damping: 14 }}
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </h1>
  );
}
