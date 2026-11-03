import { cn } from "@/lib/utils";
import styles from "./kit.module.css";

interface FundingStripProps {
    current: number;
    target: number;
    done?: boolean; // completed fundings fill in blue, like the "완료" stamp
    onPaper?: boolean; // empty cells tinted for a white background instead of a coloured one
    compact?: boolean;
}

const CELLS = 20;

// Progress shown as a row of ticket cells filling up, not a percentage bar.
export function FundingStrip({ current, target, done, onPaper, compact }: FundingStripProps) {
    const filled = Math.min(current / Math.max(target, 1), 1) * CELLS;

    return (
        <div className={cn(styles.strip, done && styles.done, onPaper && styles.onPaper, compact && styles.compact)}>
            <div className={styles.cells} role="img" aria-label={`목표 ${target}장 중 ${current}장 모임`}>
                {Array.from({ length: CELLS }, (_, i) => {
                    if (filled >= i + 1) return <i key={i} className={styles.full} />;
                    if (filled > i) {
                        return <i key={i} className={styles.part} style={{ "--w": `${(filled - i) * 100}%` } as React.CSSProperties} />;
                    }
                    return <i key={i} />;
                })}
            </div>
            <b className={styles.stripCount}>
                {current}
                <small>/ {target}장</small>
            </b>
        </div>
    );
}
