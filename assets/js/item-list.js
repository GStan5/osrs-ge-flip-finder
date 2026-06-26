(function (G) {
  function attrString(attrs) {
    if (!attrs) return "";
    return Object.entries(attrs)
      .filter(([, v]) => v != null && v !== false)
      .map(([k, v]) => {
        if (v === true) return k;
        return `${k}="${G.escapeHtml(String(v))}"`;
      })
      .join(" ");
  }

  G.itemListCell = function itemListCell(content, className, attrs) {
    const cls = ["gra-item-list__cell", className].filter(Boolean).join(" ");
    const extra = attrString(attrs);
    return `<div class="${cls}"${extra ? ` ${extra}` : ""} role="cell">${content}</div>`;
  };

  G.itemListRow = function itemListRow(cellsHtml, className) {
    const cls = ["gra-item-list__row", className].filter(Boolean).join(" ");
    return `<div class="${cls}" role="row">${cellsHtml}</div>`;
  };

  G.itemListEmpty = function itemListEmpty(message, loading) {
    const cls = loading ? "gra-item-list__empty loading" : "gra-item-list__empty";
    return `<div class="${cls}">${message}</div>`;
  };

  G.itemListNumCell = function itemListNumCell(value, className, label, attrs) {
    const cls = ["gra-item-list__cell--num", className].filter(Boolean).join(" ");
    const merged = { ...(attrs || {}), ...(label ? { "data-label": label } : {}) };
    return G.itemListCell(value, cls, merged);
  };

  G.itemListNameCell = function itemListNameCell(item, options) {
    const opts = options || {};
    const fav = opts.favHtml || "";
    const showBadge = Boolean(opts.showBadge);
    const tip = G.itemTitleAttr(item.name);
    let badge = "";
    if (showBadge) {
      badge = item.members
        ? '<span class="badge badge-members">P2P</span>'
        : '<span class="badge badge-f2p">F2P</span>';
    }
    const inner = `<div class="item-cell"${tip}>
      ${fav}
      <img src="${G.iconUrl(item.icon)}" alt="" width="28" height="28" loading="lazy" onerror="this.style.visibility='hidden'" />
      <a class="item-name" href="${G.itemPageUrl(item.id)}"${tip}>${G.escapeHtml(item.name)}</a>
      <a class="item-wiki-link" href="${G.wikiPageUrl(item.name)}" target="_blank" rel="noopener" title="OSRS Wiki">↗</a>${badge}
    </div>`;
    return G.itemListCell(inner, "gra-item-list__cell--name", { title: item.name });
  };

  G.itemListSkeletonRows = function itemListSkeletonRows(colCount, rowCount, listClass) {
    const n = Math.max(1, rowCount || 8);
    const c = Math.max(1, colCount || 6);
    let html = "";
    for (let r = 0; r < n; r++) {
      let cells = "";
      for (let i = 0; i < c; i++) {
        const w = i === 0 ? "85%" : i === c - 1 ? "45%" : "65%";
        const cellCls = i === 0 ? "gra-item-list__cell--name" : "gra-item-list__cell--num";
        cells += G.itemListCell(`<span class="loading-skeleton" style="width:${w}"></span>`, cellCls);
      }
      html += G.itemListRow(cells, "skeleton-row");
    }
    return html;
  };

  G.applyItemListSkeleton = function applyItemListSkeleton(bodyId, colCount, rows) {
    const body = G.el(bodyId);
    if (body) body.innerHTML = G.itemListSkeletonRows(colCount, rows);
  };

  G.bindItemListSort = function bindItemListSort(listId, handler, sortAttr) {
    const list = G.el(listId);
    if (!list) return;
    const attr = sortAttr || "data-sort";
    list.querySelectorAll(`.gra-item-list__head.sortable[${attr}]`).forEach((head) => {
      head.addEventListener("click", () => handler(head.getAttribute(attr)));
    });
  };

  G.updateItemListSort = function updateItemListSort(listId, key, dir, sortAttr) {
    const list = G.el(listId);
    if (!list) return;
    const attr = sortAttr || "data-sort";
    list.querySelectorAll(`.gra-item-list__head.sortable[${attr}]`).forEach((head) => {
      const active = head.getAttribute(attr) === key;
      head.classList.toggle("sorted-asc", active && dir === "asc");
      head.classList.toggle("sorted-desc", active && dir === "desc");
    });
  };

  G.itemNameCell = function itemNameCell(item) {
    return G.itemListNameCell(item, { showBadge: false });
  };

  /**
   * Render rows into a .gra-item-list__body container.
   * @param {string} bodyId - id of .gra-item-list__body
   * @param {{ rowsHtml?: string, message?: string, loading?: boolean, listId?: string, sortKey?: string, sortDir?: string, sortAttr?: string }} opts
   */
  G.renderItemList = function renderItemList(bodyId, opts) {
    const body = G.el(bodyId);
    if (!body) return;
    const options = opts || {};
    if (options.message != null) {
      body.innerHTML = G.itemListEmpty(options.message, options.loading);
    } else {
      body.innerHTML = options.rowsHtml || "";
    }
    if (options.listId && options.sortKey != null) {
      G.updateItemListSort(options.listId, options.sortKey, options.sortDir || "desc", options.sortAttr);
    }
  };

  G.renderItemListHeader = function renderItemListHeader(listId, columns, sort) {
    const list = G.el(listId);
    if (!list) return;
    const header = list.querySelector(".gra-item-list__header");
    if (!header) return;
    header.innerHTML = columns
      .map((col) => {
        const sortCls = col.sortable ? " sortable" : "";
        const cls = ["gra-item-list__head", col.className, sortCls].filter(Boolean).join(" ");
        const attr = col.sortAttr || "data-sort";
        const sortKey = col.sortKey ?? col.key;
        const sortAttr = col.sortable ? ` ${attr}="${G.escapeHtml(String(sortKey))}"` : "";
        const active = sort && sort.key === sortKey;
        const sortedCls =
          active && sort.dir === "asc" ? " sorted-asc" : active && sort.dir === "desc" ? " sorted-desc" : "";
        return `<div class="${cls}${sortedCls}" role="columnheader"${sortAttr}>${col.label}</div>`;
      })
      .join("");
  };
})(window.Graardor);
