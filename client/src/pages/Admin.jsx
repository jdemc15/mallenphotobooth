import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, uploadFile } from "../lib";

const defaultSlots = [
  { x: 80, y: 180, width: 500, height: 610 },
  { x: 620, y: 180, width: 500, height: 610 },
  { x: 80, y: 860, width: 500, height: 610 },
  { x: 620, y: 860, width: 500, height: 610 }
];

function blankSub() {
  return {
    id: "",
    name: "",
    enabled: true,
    captureCount: 6,
    finalPhotoCount: 4,
    countdownSeconds: 3,
    fitMode: "cover",
    canvas: { width: 1200, height: 1800 },
    background: "",
    overlay: "",
    backgroundColor: "#ffffff",
    slotBackground: "#ffffff",
    slots: defaultSlots.map(x => ({ ...x }))
  };
}

export default function Admin() {
  const [templates, setTemplates] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryForm, setCategoryForm] = useState({
    id: "", name: "", enabled: true, coverImage: ""
  });
  const [subForm, setSubForm] = useState(blankSub());
  const [message, setMessage] = useState("");

  const selectedCategory = useMemo(
    () => templates.find(x => x.id === selectedCategoryId),
    [templates, selectedCategoryId]
  );

  async function refresh() {
    const data = await api("/api/templates");
    setTemplates(data);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  function editCategory(cat) {
    setSelectedCategoryId(cat.id);
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      enabled: cat.enabled,
      coverImage: cat.coverImage || ""
    });
    setSubForm(blankSub());
  }

  async function saveCategory(e) {
    e.preventDefault();

    if (categoryForm.id) {
      await api(`/api/categories/${categoryForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm)
      });
    } else {
      const created = await api("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm)
      });
      setSelectedCategoryId(created.id);
      setCategoryForm({
        id: created.id,
        name: created.name,
        enabled: created.enabled,
        coverImage: created.coverImage
      });
    }

    setMessage("Template saved.");
    await refresh();
  }

  async function deleteCategory(id) {
    if (!confirm("Delete this template and all subtemplates?")) return;
    await api(`/api/categories/${id}`, { method: "DELETE" });
    if (selectedCategoryId === id) {
      setSelectedCategoryId("");
      setCategoryForm({ id: "", name: "", enabled: true, coverImage: "" });
      setSubForm(blankSub());
    }
    await refresh();
  }

  async function saveSub(e) {
    e.preventDefault();
    if (!selectedCategoryId) {
      setMessage("Open or create a template first.");
      return;
    }

    const endpoint = subForm.id
      ? `/api/categories/${selectedCategoryId}/subtemplates/${subForm.id}`
      : `/api/categories/${selectedCategoryId}/subtemplates`;

    await api(endpoint, {
      method: subForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subForm)
    });

    setMessage("Subtemplate saved.");
    setSubForm(blankSub());
    await refresh();
  }

  async function deleteSub(id) {
    if (!confirm("Delete this subtemplate?")) return;
    await api(`/api/categories/${selectedCategoryId}/subtemplates/${id}`, {
      method: "DELETE"
    });
    setSubForm(blankSub());
    await refresh();
  }

  async function uploadCategoryCover(file) {
    if (!file) return;
    const url = await uploadFile(file);
    setCategoryForm(prev => ({ ...prev, coverImage: url }));
  }

  async function uploadSubAsset(field, file) {
    if (!file) return;
    const url = await uploadFile(file);
    setSubForm(prev => ({ ...prev, [field]: url }));
  }

  function updateSlot(index, key, value) {
    setSubForm(prev => ({
      ...prev,
      slots: prev.slots.map((slot, i) =>
        i === index ? { ...slot, [key]: Number(value) } : slot
      )
    }));
  }

  return (
    <div className="app admin">
      <header className="header">
        <div>
          <div className="eyebrow">OWNER MODE</div>
          <h1>Photobooth Admin</h1>
        </div>
        <Link className="ghostButton" to="/">Back to Kiosk</Link>
      </header>

      {message && <div className="notice">{message}</div>}

      <section className="section">
        <div className="stepTitle">
          <span>A</span>
          <div>
            <h2>Templates</h2>
            <p>Main collections shown on the kiosk.</p>
          </div>
        </div>

        <div className="adminList">
          {templates.map(cat => (
            <div className="adminRow" key={cat.id}>
              <div>
                <strong>{cat.name}</strong>
                <small>{cat.subtemplates?.length || 0} subtemplate(s)</small>
              </div>
              <div className="actions">
                <button onClick={() => editCategory(cat)}>Open / Edit</button>
                <button className="danger" onClick={() => deleteCategory(cat.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <form className="form" onSubmit={saveCategory}>
          <h3>{categoryForm.id ? "Edit Template" : "Create Template"}</h3>

          <label>
            Template name
            <input
              required
              value={categoryForm.name}
              onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
            />
          </label>

          <label className="inlineCheck">
            <input
              type="checkbox"
              checked={categoryForm.enabled}
              onChange={e => setCategoryForm({ ...categoryForm, enabled: e.target.checked })}
            />
            Enabled on kiosk
          </label>

          <label>
            Template cover image
            <input type="file" accept="image/*" onChange={e => uploadCategoryCover(e.target.files[0])} />
          </label>

          {categoryForm.coverImage && (
            <img className="adminPreview" src={categoryForm.coverImage} alt="" />
          )}

          <div className="actions">
            <button className="primary" type="submit">Save Template</button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId("");
                setCategoryForm({ id: "", name: "", enabled: true, coverImage: "" });
                setSubForm(blankSub());
              }}
            >
              New Template
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <div className="stepTitle">
          <span>B</span>
          <div>
            <h2>Subtemplates</h2>
            <p>{selectedCategory ? `Editing ${selectedCategory.name}` : "Open a template first."}</p>
          </div>
        </div>

        {selectedCategory && (
          <>
            <div className="adminList">
              {selectedCategory.subtemplates.map(sub => (
                <div className="adminRow" key={sub.id}>
                  <div>
                    <strong>{sub.name}</strong>
                    <small>{sub.captureCount} shots → {sub.finalPhotoCount} final</small>
                  </div>
                  <div className="actions">
                    <button onClick={() => setSubForm(JSON.parse(JSON.stringify(sub)))}>Edit</button>
                    <button className="danger" onClick={() => deleteSub(sub.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>

            <form className="form" onSubmit={saveSub}>
              <h3>{subForm.id ? `Edit ${subForm.name}` : "Create Subtemplate"}</h3>

              <label>
                Subtemplate name
                <input
                  required
                  value={subForm.name}
                  onChange={e => setSubForm({ ...subForm, name: e.target.value })}
                />
              </label>

              <div className="twoCol">
                <label>
                  Shots to take (4–6)
                  <input
                    type="number"
                    min="4"
                    max="6"
                    value={subForm.captureCount}
                    onChange={e => setSubForm({ ...subForm, captureCount: Number(e.target.value) })}
                  />
                </label>

                <label>
                  Photos in final print
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={subForm.finalPhotoCount}
                    onChange={e => setSubForm({ ...subForm, finalPhotoCount: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="twoCol">
                <label>
                  Countdown
                  <select
                    value={subForm.countdownSeconds}
                    onChange={e => setSubForm({ ...subForm, countdownSeconds: Number(e.target.value) })}
                  >
                    <option value="3">3 seconds</option>
                    <option value="5">5 seconds</option>
                    <option value="8">8 seconds</option>
                  </select>
                </label>

                <label>
                  Photo fit
                  <select
                    value={subForm.fitMode}
                    onChange={e => setSubForm({ ...subForm, fitMode: e.target.value })}
                  >
                    <option value="contain">Fit entire photo — no crop</option>
                    <option value="cover">Fill slot — crop edges</option>
                  </select>
                </label>
              </div>

              <label className="inlineCheck">
                <input
                  type="checkbox"
                  checked={subForm.enabled}
                  onChange={e => setSubForm({ ...subForm, enabled: e.target.checked })}
                />
                Enabled on kiosk
              </label>

              <div className="twoCol">
                <label>
                  Background image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => uploadSubAsset("background", e.target.files[0])}
                  />
                </label>

                <label>
                  Transparent overlay PNG
                  <input
                    type="file"
                    accept="image/png"
                    onChange={e => uploadSubAsset("overlay", e.target.files[0])}
                  />
                </label>
              </div>

              <div className="twoCol">
                {subForm.background && <img className="adminPreview" src={subForm.background} alt="" />}
                {subForm.overlay && <img className="adminPreview transparency" src={subForm.overlay} alt="" />}
              </div>

              <h3>Final print slots</h3>
              <p className="muted">Coordinates are based on the 1200×1800 print canvas.</p>

              <div className="slotEditor">
                {subForm.slots.map((slot, i) => (
                  <div className="slotRow" key={i}>
                    <strong>Slot {i + 1}</strong>
                    {["x", "y", "width", "height"].map(key => (
                      <label key={key}>
                        {key}
                        <input
                          type="number"
                          value={slot[key]}
                          onChange={e => updateSlot(i, key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>

              <div className="actions">
                <button className="primary" type="submit">Save Subtemplate</button>
                <button type="button" onClick={() => setSubForm(blankSub())}>New Subtemplate</button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
