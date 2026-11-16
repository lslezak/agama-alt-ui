import { motion } from "framer-motion";

/** Three bouncing orbs with a caption. */
export function Loader({ label }: { label: string }) {
  return (
    <div className="loader">
      <div className="loader__orbs">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="loader__orb"
            animate={{ y: [0, -22, 0], scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <p className="loader__label">{label}</p>
    </div>
  );
}
