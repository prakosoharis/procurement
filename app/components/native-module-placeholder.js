export default function NativeModulePlaceholder({ title, description, checkpoint, legacyNote }) {
  return <div className="grid" style={{ gap: 18 }}>
    <section className="card" style={{ padding: 24 }}>
      <div className="eyebrow" style={{ color: '#991b1b' }}>Native module foundation</div>
      <h1 style={{ margin: '7px 0 8px', fontSize: 26 }}>{title}</h1>
      <p className="muted" style={{ maxWidth: 720, lineHeight: 1.6 }}>{description}</p>
      <div className="notice" style={{ marginTop: 18 }}>This native route is ready for implementation in {checkpoint}. No business workflow has been duplicated from the legacy application.</div>
    </section>
    {legacyNote && <section className="card"><h3 style={{ marginTop: 0 }}>Legacy availability</h3><p className="muted" style={{ marginBottom: 0 }}>{legacyNote}</p></section>}
  </div>;
}
