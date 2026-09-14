import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import styles from "../../../app/admin/admin.module.css";

interface CollectionControlsProps {
  label: string;
  index: number;
  count: number;
  minimum?: number;
  onAdd: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function CollectionControls({
  label,
  index,
  count,
  minimum = 0,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
}: CollectionControlsProps) {
  const position = `${label} ${index + 1}`;

  return (
    <div className={styles.collectionControls}>
      <button type="button" title={`在${position}后添加`} aria-label={`在${position}后添加`} onClick={onAdd}>
        <Plus size={16} />
      </button>
      <button
        type="button"
        title={`删除${position}`}
        aria-label={`删除${position}`}
        onClick={onRemove}
        disabled={count <= minimum}
      >
        <Trash2 size={16} />
      </button>
      <button type="button" title={`${position}上移`} aria-label={`${position}上移`} onClick={onMoveUp} disabled={index === 0}>
        <ArrowUp size={16} />
      </button>
      <button
        type="button"
        title={`${position}下移`}
        aria-label={`${position}下移`}
        onClick={onMoveDown}
        disabled={index === count - 1}
      >
        <ArrowDown size={16} />
      </button>
    </div>
  );
}
