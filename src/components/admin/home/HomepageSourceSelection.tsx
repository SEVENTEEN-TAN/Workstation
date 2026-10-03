import type { HomepageSelection, SiteContent } from "../../../lib/content/schema";
import styles from "../../../app/admin/admin.module.css";

export type HomepageSourceOptions = Record<keyof HomepageSelection, Array<{ id: string; label: string }>>;
const labels = { activities: "当前动态", skills: "能力域", experiences: "经历" };

export function HomepageSourceSelection({ content, options, onChange }: {
  content: SiteContent; options: HomepageSourceOptions; onChange(content: SiteContent): void;
}) {
  function update(key: keyof HomepageSelection, ids: string[] | undefined) {
    onChange({ ...content, homepageSelection: { ...content.homepageSelection, [key]: ids } });
  }
  return <details aria-label="首页业务内容选择" className={`${styles.panel} ${styles.homeSourceSelection}`}>
    <summary>业务内容选择与顺序</summary>
    <p>这里选择公开源记录，不修改源资料。每类按顺序展示前三项；未公开或已删除的记录不会展示，源内容更新后随模块更新。项目选择与顺序在字段编辑的项目展示中维护。</p>
    {(Object.keys(labels) as Array<keyof HomepageSelection>).map((key) => {
      const selected = content.homepageSelection?.[key];
      const ids = selected ?? options[key].map(({ id }) => id);
      return <fieldset key={key} className={styles.panel}>
        <legend>{labels[key]}</legend>
        <label className={styles.homeSourceChoice}><input type="checkbox" checked={selected === undefined} onChange={(event) => update(key, event.target.checked ? undefined : options[key].map(({ id }) => id))} />自动展示公开内容（沿用模块顺序）</label>
        {selected !== undefined && <>
          {ids.map((id, index) => <div key={id} className={styles.actions}>
            <span>{options[key].find((item) => item.id === id)?.label ?? "源记录已不可用"}</span>
            <button type="button" aria-label={`上移${labels[key]}记录${index + 1}`} disabled={index === 0} onClick={() => { const next = [...ids]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update(key, next); }}>上移</button>
            <button type="button" aria-label={`下移${labels[key]}记录${index + 1}`} disabled={index === ids.length - 1} onClick={() => { const next = [...ids]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; update(key, next); }}>下移</button>
            <button type="button" onClick={() => update(key, ids.filter((value) => value !== id))}>取消选择</button>
          </div>)}
          <label>添加{labels[key]}<select value="" onChange={(event) => { if (event.target.value) update(key, [...ids, event.target.value]); }}>
            <option value="">选择公开记录</option>
            {options[key].filter(({ id }) => !ids.includes(id)).map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select></label>
          {!ids.length && <p>没有选择记录，本区块不展示源记录。</p>}
        </>}
      </fieldset>;
    })}
  </details>;
}
