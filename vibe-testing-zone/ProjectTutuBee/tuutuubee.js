(() => {
  /**
   * This is a static mirror of your bulk-data hierarchy.
   * You can extend it by adding more children that follow the same pattern.
   *
   * Example real path:
   * bulk-data/01_Domestic/01_Total_trips/UN_Tourism_domestic_trips_12_2025.xlsx
   */
  const DATA_TREE = {
    name: "bulk-data",
    key: "bulk-data",
    type: "root",
    children: [
      {
        name: "Domestic",
        key: "01_Domestic",
        type: "category",
        theme: "domestic",
        description: "Domestic tourism datasets (trips, nights, accommodation…).",
        children: [
          {
            name: "Total trips",
            key: "01_Total_trips",
            type: "subcategory",
            description: "Total domestic trips over time, by purpose or region.",
            children: [
              {
                name: "UN_Tourism_domestic_trips_12_2025.xlsx",
                key: "UN_Tourism_domestic_trips_12_2025.xlsx",
                type: "file",
                kind: "time-series",
                path: "bulk-data/01_Domestic/01_Total_trips/UN_Tourism_domestic_trips_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Accommodation",
            key: "02_Accommodation",
            type: "subcategory",
            description: "Domestic accommodation indicators (e.g. nights, capacity, guests).",
            children: [
              {
                name: "UN_Tourism_domestic_accommodation_12_2025.xlsx",
                key: "UN_Tourism_domestic_accommodation_12_2025.xlsx",
                type: "file",
                kind: "accommodation",
                path: "bulk-data/01_Domestic/02_Accommodation/UN_Tourism_domestic_accommodation_12_2025.xlsx",
              },
            ],
          },
        ],
      },
      {
        name: "Inbound",
        key: "02_Inbound",
        type: "category",
        theme: "business",
        description: "Inbound (international) tourism datasets such as total arrivals.",
        children: [
          {
            name: "Total arrivals",
            key: "01_Total_arrivals",
            type: "subcategory",
            description: "Total inbound arrivals over time, by origin or purpose.",
            children: [
              {
                name: "UN_Tourism_inbound_arrivals_12_2025.xlsx",
                key: "UN_Tourism_inbound_arrivals_12_2025.xlsx",
                type: "file",
                kind: "time-series",
                path: "bulk-data/02_Inbound/01_Total_arrivals/UN_Tourism_inbound_arrivals_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Expenditure",
            key: "02_Expenditure",
            type: "subcategory",
            description: "Inbound tourism expenditure (e.g. by item or origin).",
            children: [
              {
                name: "UN_Tourism_inbound_expenditure_12_2025.xlsx",
                key: "UN_Tourism_inbound_expenditure_12_2025.xlsx",
                type: "file",
                kind: "expenditure",
                path: "bulk-data/02_Inbound/02_Expenditure/UN_Tourism_inbound_expenditure_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Arrivals by region",
            key: "03_Total_arrivals_by_region",
            type: "subcategory",
            description: "Inbound arrivals broken down by region of origin.",
            children: [
              {
                name: "UN_Tourism_inbound_arrivals_by_region_12_2025.xlsx",
                key: "UN_Tourism_inbound_arrivals_by_region_12_2025.xlsx",
                type: "file",
                kind: "by-region",
                path: "bulk-data/02_Inbound/03_Total_arrivals_by_region/UN_Tourism_inbound_arrivals_by_region_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Arrivals by purpose",
            key: "04_Total_arrivals_by_main_purpose",
            type: "subcategory",
            description: "Inbound arrivals by main purpose of trip.",
            children: [
              {
                name: "UN_Tourism_inbound_arrivals_by_purpose_12_2025.xlsx",
                key: "UN_Tourism_inbound_arrivals_by_purpose_12_2025.xlsx",
                type: "file",
                kind: "by-purpose",
                path: "bulk-data/02_Inbound/04_Total_arrivals_by_main_purpose/UN_Tourism_inbound_arrivals_by_purpose_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Arrivals by transport mode",
            key: "05_Total_arrivals_by_mode_of_transport",
            type: "subcategory",
            description: "Inbound arrivals by main mode of transport.",
            children: [
              {
                name: "UN_Tourism_inbound_arrivals_by_transport_12_2025.xlsx",
                key: "UN_Tourism_inbound_arrivals_by_transport_12_2025.xlsx",
                type: "file",
                kind: "by-transport",
                path: "bulk-data/02_Inbound/05_Total_arrivals_by_mode_of_transport/UN_Tourism_inbound_arrivals_by_transport_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Accommodation guests & overnights",
            key: "06_Accommodation_guests_and_overnights",
            type: "subcategory",
            description: "Inbound guests and overnights in accommodation establishments.",
            children: [
              {
                name: "UN_Tourism_inbound_accommodation_12_2025.xlsx",
                key: "UN_Tourism_inbound_accommodation_12_2025.xlsx",
                type: "file",
                kind: "accommodation",
                path: "bulk-data/02_Inbound/06_Accommodation_guests_and_overnights/UN_Tourism_inbound_accommodation_12_2025.xlsx",
              },
            ],
          },
        ],
      },
      {
        name: "Outbound",
        key: "03_Outbound",
        type: "category",
        theme: "domestic",
        description: "Outbound tourism datasets such as departures and expenditure abroad.",
        children: [
          {
            name: "Total departures",
            key: "01_Total_departures",
            type: "subcategory",
            description: "Total outbound departures over time.",
            children: [
              {
                name: "UN_Tourism_outbound_departures_12_2025.xlsx",
                key: "UN_Tourism_outbound_departures_12_2025.xlsx",
                type: "file",
                kind: "time-series",
                path: "bulk-data/03_Outbound/01_Total_departures/UN_Tourism_outbound_departures_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Expenditure",
            key: "02_Expenditure",
            type: "subcategory",
            description: "Outbound tourism expenditure.",
            children: [
              {
                name: "UN_Tourism_outbound_expenditure_12_2025.xlsx",
                key: "UN_Tourism_outbound_expenditure_12_2025.xlsx",
                type: "file",
                kind: "expenditure",
                path: "bulk-data/03_Outbound/02_Expenditure/UN_Tourism_outbound_expenditure_12_2025.xlsx",
              },
            ],
          },
        ],
      },
      {
        name: "Accommodation (all)",
        key: "04_Accommodation",
        type: "category",
        theme: "research",
        description: "Accommodation indicators across hotels and other establishments.",
        children: [
          {
            name: "Hotels & similar",
            key: "01_Accommodation_in_hotels_and_similar_establishments",
            type: "subcategory",
            description: "Accommodation in hotels and similar establishments.",
            children: [
              {
                name: "UN_Tourism_accommodation_hotels_12_2025.xlsx",
                key: "UN_Tourism_accommodation_hotels_12_2025.xlsx",
                type: "file",
                kind: "accommodation",
                path: "bulk-data/04_Accommodation/01_Accommodation_in_hotels_and_similar_establishments/UN_Tourism_accommodation_hotels_12_2025.xlsx",
              },
            ],
          },
          {
            name: "Other indicators",
            key: "02_Other_indicators",
            type: "subcategory",
            description: "Other accommodation-related indicators.",
            children: [
              {
                name: "UN_Tourism_accommodation_other_indicators_12_2025.xlsx",
                key: "UN_Tourism_accommodation_other_indicators_12_2025.xlsx",
                type: "file",
                kind: "accommodation",
                path: "bulk-data/04_Accommodation/02_Other_indicators/UN_Tourism_accommodation_other_indicators_12_2025.xlsx",
              },
            ],
          },
        ],
      },
      {
        name: "Macroeconomic",
        key: "05_Macroeconomic",
        type: "category",
        theme: "business",
        description: "Macroeconomic indicators related to tourism and SDG 8.9.1.",
        children: [
          {
            name: "Tourism direct GDP",
            key: "UN_Tourism_8_9_1_TDGDP_04_2025.xlsx",
            type: "file",
            kind: "macro",
            path: "bulk-data/05_Macroeconomic/UN_Tourism_8_9_1_TDGDP_04_2025.xlsx",
          },
          {
            name: "Tourism direct GDP metadata (PDF)",
            key: "UN_Tourism_8_9_1_TDGDP_metadata_04_2025.pdf",
            type: "file",
            kind: "metadata",
            path: "bulk-data/05_Macroeconomic/UN_Tourism_8_9_1_TDGDP_metadata_04_2025.pdf",
          },
        ],
      },
      {
        name: "Employment",
        key: "06_Employment",
        type: "category",
        theme: "domestic",
        description: "Tourism-related employment indicators (SDG 8.9.2).",
        children: [
          {
            name: "Employed persons",
            key: "UN_Tourism_8_9_2_employed_persons_04_2025.xlsx",
            type: "file",
            kind: "employment",
            path: "bulk-data/06_Employment/UN_Tourism_8_9_2_employed_persons_04_2025.xlsx",
          },
          {
            name: "Employed persons metadata (PDF)",
            key: "UN_Tourism_8_9_2_employed_persons_metadata_04_2025.pdf",
            type: "file",
            kind: "metadata",
            path: "bulk-data/06_Employment/UN_Tourism_8_9_2_employed_persons_metadata_04_2025.pdf",
          },
        ],
      },
      {
        name: "SDGs",
        key: "07_SDGs",
        type: "category",
        theme: "research",
        description: "Tourism-related SDG 12.b.1 indicators.",
        children: [
          {
            name: "TSA-SEEA",
            key: "UN_Tourism_12_b_1_TSA_SEEA_04_2025.xlsx",
            type: "file",
            kind: "sdg",
            path: "bulk-data/07_SDGs/UN_Tourism_12_b_1_TSA_SEEA_04_2025.xlsx",
          },
          {
            name: "TSA-SEEA metadata (PDF)",
            key: "UN_Tourism_12_b_1_TSA_SEEA_metadata_04_2025.pdf",
            type: "file",
            kind: "metadata",
            path: "bulk-data/07_SDGs/UN_Tourism_12_b_1_TSA_SEEA_metadata_04_2025.pdf",
          },
        ],
      },
    ],
  };

  const themeFor = (node) => {
    if (node.theme) return node.theme;
    const root = DATA_TREE.children.find((c) => node.key && node.key.startsWith(c.key[0]));
    return root?.theme ?? "domestic";
  };

  const sidebarRoot = document.getElementById("sidebar-root");
  const panelList = document.getElementById("panel-list");
  const panelViz = document.getElementById("panel-viz");
  const breadcrumbEl = document.getElementById("breadcrumb");

  if (!sidebarRoot || !panelList || !panelViz || !breadcrumbEl) return;

  let currentPath = [DATA_TREE.children[0]?.key ?? "01_Domestic"]; // default to Domestic

  const findNodeByPath = (pathArr) => {
    let node = DATA_TREE;
    for (const key of pathArr) {
      node =
        node.children?.find((c) => c.key === key) ??
        node.children?.find((c) => c.name === key);
      if (!node) break;
    }
    return node ?? DATA_TREE;
  };

  const buildBreadcrumb = () => {
    const parts = [];
    let node = DATA_TREE;
    parts.push({ label: "bulk-data", path: [] });

    const pathArr = [];
    for (const key of currentPath) {
      const next = node.children?.find((c) => c.key === key);
      if (!next) break;
      pathArr.push(next.key);
      parts.push({ label: next.name, path: [...pathArr] });
      node = next;
    }

    breadcrumbEl.innerHTML = "";
    parts.forEach((part, idx) => {
      const span = document.createElement("span");
      span.className = "tb-breadcrumb__item";
      if (idx < parts.length - 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tb-breadcrumb__btn";
        btn.textContent = part.label;
        btn.addEventListener("click", () => {
          currentPath = [...part.path];
          render();
        });
        span.appendChild(btn);
        const sep = document.createElement("span");
        sep.textContent = "›";
        span.appendChild(sep);
      } else {
        span.textContent = part.label;
      }
      breadcrumbEl.appendChild(span);
    });
  };

  const renderSidebar = () => {
    sidebarRoot.innerHTML = "";

    DATA_TREE.children.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tb-navItem tb-navItem--${cat.theme ?? "domestic"}`;

      const left = document.createElement("span");
      left.className = "tb-mainIcon";
      left.textContent =
        cat.theme === "domestic" ? "🏡" : cat.theme === "business" ? "💼" : "🔬";

      const label = document.createElement("span");
      label.textContent = cat.name;

      const count = document.createElement("span");
      count.className = "tb-count";
      count.textContent = `${cat.children?.length ?? 0} groups`;

      const wrapper = document.createElement("span");
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";
      wrapper.append(left, label);

      btn.append(wrapper, count);
      btn.addEventListener("click", () => {
        currentPath = [cat.key];
        render();
      });

      sidebarRoot.appendChild(btn);
    });
  };

  const renderListPanel = () => {
    const node = findNodeByPath(currentPath);

    panelList.innerHTML = "";

    const head = document.createElement("div");
    head.className = "tb-panel__head";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "tb-panel__title";
    title.textContent = node.name || "Category";
    const subtitle = document.createElement("p");
    subtitle.className = "tb-panel__subtitle";
    subtitle.textContent =
      node.description ||
      (node.type === "file"
        ? "Data file selected."
        : "Browse into a mini-category or pick a file to see a dashboard.");

    titleWrap.append(title, subtitle);

    const badge = document.createElement("span");
    badge.className = `tb-badgeCategory tb-badgeCategory--${themeFor(node)}`;
    badge.textContent =
      node.type === "file"
        ? "Data file"
        : node.type === "subcategory"
          ? "Mini-category"
          : "Category";

    head.append(titleWrap, badge);

    panelList.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "tb-listGrid";

    if (!node.children || !node.children.length) {
      const empty = document.createElement("p");
      empty.className = "tb-panel__subtitle";
      empty.textContent =
        node.type === "file"
          ? "This data file is ready for a dashboard (mock visual shown on the right)."
          : "No further subfolders or files defined yet. Add more children in tuutuubee.js.";
      panelList.appendChild(empty);
      return;
    }

    node.children.forEach((child) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tb-nodeCard tb-nodeCard--${child.type === "file" ? "file" : "folder"} tb-nodeCard--${themeFor(
        node,
      )}`;

      const label = document.createElement("div");
      label.className = "tb-nodeCard__label";
      label.textContent = child.name;

      const meta = document.createElement("div");
      meta.className = "tb-nodeCard__meta";
      meta.textContent =
        child.type === "file"
          ? (child.kind === "time-series" ? "Time-series dataset (e.g. trips by month)." : "Data file.")
          : `${child.children?.length ?? 0} item(s) inside`;

      const tag = document.createElement("div");
      tag.className = "tb-nodeCard__tag";
      const pill =
        child.type === "file"
          ? Object.assign(document.createElement("span"), {
              className: "tb-pillFile",
              textContent: "File",
            })
          : Object.assign(document.createElement("span"), {
              className: "tb-pillFolder",
              textContent: "Mini-category",
            });
      const hint = document.createElement("span");
      hint.textContent = child.type === "file" ? "View dashboard" : "Drill down";
      tag.append(pill, hint);

      button.append(label, meta, tag);
      button.addEventListener("click", () => {
        currentPath = [...currentPath, child.key];
        render();
      });

      grid.appendChild(button);
    });

    panelList.appendChild(grid);
  };

  const renderDomesticTripsDashboard = (node) => {
    panelViz.innerHTML = "";

    const head = document.createElement("div");
    head.className = "tb-panel__head";
    const left = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "tb-panel__title";
    title.textContent = "Domestic total trips – overview";
    const subtitle = document.createElement("p");
    subtitle.className = "tb-panel__subtitle";
    subtitle.textContent =
      "Illustrative dashboard for the domestic trips time-series (levels, seasonality, composition).";
    left.append(title, subtitle);

    const badge = document.createElement("span");
    badge.className = "tb-pillFile";
    badge.textContent = "Time-series · Domestic trips";

    head.append(left, badge);
    panelViz.appendChild(head);

    const layout = document.createElement("div");
    layout.className = "tb-vizLayout";

    const leftCol = document.createElement("div");
    leftCol.className = "tb-vizLeft";

    // Headline metrics
    const metrics = document.createElement("div");
    metrics.className = "tb-metrics";
    [
      {
        label: "Total trips",
        value: "128 M",
        hint: "Last 12 months · mock value",
      },
      {
        label: "Trips per capita",
        value: "3.1",
        hint: "Trips / resident · mock",
      },
      {
        label: "Weekend share",
        value: "42%",
        hint: "Of all domestic trips",
      },
    ].forEach((m) => {
      const box = document.createElement("div");
      box.className = "tb-metric";
      box.innerHTML = `
        <div class="tb-metric__label">${m.label}</div>
        <div class="tb-metric__value">${m.value}</div>
        <div class="tb-metric__hint">${m.hint}</div>
      `;
      metrics.appendChild(box);
    });

    // Purpose composition bar chart
    const barChart = document.createElement("div");
    barChart.className = "tb-chart";
    barChart.innerHTML = `
      <div class="tb-chart__title">Trips by main purpose</div>
      <p class="tb-chart__hint">Recreation, visiting friends/relatives, and business (mock composition).</p>
      <div class="tb-chartBar">
        <div class="tb-bar" style="height: 80%;" title="Recreation"></div>
        <div class="tb-bar tb-bar--secondary" style="height: 64%;" title="VFR"></div>
        <div class="tb-bar" style="height: 38%;" title="Business"></div>
      </div>
    `;

    // Seasonality line chart
    const lineChart = document.createElement("div");
    lineChart.className = "tb-chart tb-chartLine";
    lineChart.innerHTML = `
      <div class="tb-chart__title">Trips over months</div>
      <p class="tb-chart__hint">Seasonal pattern across 12 months (peak around summer, mock curve).</p>
      <svg class="tb-lineSvg" viewBox="0 0 100 40" aria-hidden="true">
        <defs>
          <linearGradient id="tbGradientArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(139,182,255,0.6)" />
            <stop offset="100%" stop-color="rgba(139,182,255,0)" />
          </linearGradient>
        </defs>
        <path class="tb-lineBg" d="M0 10 H100" />
        <path
          class="tb-linePlot"
          d="M0 32 C 10 30, 20 24, 30 20 S 50 10, 60 12, 75 18, 90 26, 100 30 L100 40 L0 40 Z"
        />
      </svg>
    `;

    leftCol.append(metrics, barChart, lineChart);

    const rightCol = document.createElement("div");

    // Weekend vs weekday donut
    const donutCard = document.createElement("div");
    donutCard.className = "tb-chart";
    const circumference = 2 * Math.PI * 20;
    const weekendShare = 0.42;
    donutCard.innerHTML = `
      <div class="tb-chart__title">Weekend vs weekday trips</div>
      <p class="tb-chart__hint">Illustrative split of domestic trips by departure day.</p>
      <div class="tb-chartDonut">
        <svg class="tb-donutSvg" viewBox="0 0 60 60" aria-hidden="true">
          <defs>
            <linearGradient id="tbDonutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff7aa2" />
              <stop offset="100%" stop-color="#8bb6ff" />
            </linearGradient>
          </defs>
          <circle class="tb-donutTrack" cx="30" cy="30" r="20" />
          <circle
            class="tb-donutValue"
            cx="30"
            cy="30"
            r="20"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference * (1 - weekendShare)}"
          />
        </svg>
        <div>
          <div class="tb-donutLabel">Weekend share</div>
          <div class="tb-donutPercent">${Math.round(weekendShare * 100)}%</div>
          <div class="tb-metric__hint">Mock value – adjust once real trips by day are loaded.</div>
        </div>
      </div>
    `;

    // Tiny "heatmap" grid for regions (fake but visually rich)
    const heatCard = document.createElement("div");
    heatCard.className = "tb-chart";
    heatCard.innerHTML = `
      <div class="tb-chart__title">Trips by broad region</div>
      <p class="tb-chart__hint">Relative intensity of trips to different domestic regions (mock scale).</p>
      <div class="tb-files__list" style="margin-top: 6px;">
        <span class="tb-fileChip">Coastal · high</span>
        <span class="tb-fileChip">Capital city · high</span>
        <span class="tb-fileChip">Rural · medium</span>
        <span class="tb-fileChip">Remote · low</span>
      </div>
      <div class="tb-pillNote">
        Map or tile-based heatmap would be ideal once you have regions in the dataset.
      </div>
    `;

    const filesCard = document.createElement("div");
    filesCard.className = "tb-files";
    filesCard.innerHTML = `
      <div class="tb-files__label">File info</div>
      <div class="tb-files__list">
        <span class="tb-fileChip">Excel · .xlsx</span>
        <span class="tb-fileChip">Domestic total trips</span>
        <span class="tb-fileChip">Last updated: Dec 2025 (from filename)</span>
      </div>
      <div class="tb-pillNote">
        Path: <code>${node.path || "(set path in tuutuubee.js)"}</code><br />
        Hook this up to a backend / notebook to feed real time-series into the charts.
      </div>
    `;

    rightCol.append(donutCard, heatCard, filesCard);

    layout.append(leftCol, rightCol);
    panelViz.appendChild(layout);
  };

  const loadExcelData = async (node) => {
    if (!window.XLSX || !node.path || !node.path.endsWith(".xlsx")) return null;
    try {
      const res = await fetch(node.path);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (!rows.length) return null;

      const header = rows[0].map((h) => (h == null ? "" : String(h)));
      const dataRows = rows.slice(1);

      const numericCols = [];
      for (let col = 0; col < header.length; col++) {
        let numericCount = 0;
        let nonNull = 0;
        for (const r of dataRows) {
          const v = r[col];
          if (v == null || v === "") continue;
          nonNull++;
          if (typeof v === "number") numericCount++;
        }
        if (nonNull > 0 && numericCount / nonNull > 0.6) {
          numericCols.push(col);
        }
      }

      return { header, rows: dataRows, numericCols };
    } catch {
      return null;
    }
  };

  const renderRealDataDashboard = async (node) => {
    const data = await loadExcelData(node);
    panelViz.innerHTML = "";

    const head = document.createElement("div");
    head.className = "tb-panel__head";
    const left = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "tb-panel__title";
    title.textContent = node.name;
    const subtitle = document.createElement("p");
    subtitle.className = "tb-panel__subtitle";
    subtitle.textContent = data
      ? "Visualisation based on real values from the first sheet."
      : "Unable to load data from this file.";
    left.append(title, subtitle);

    const badge = document.createElement("span");
    badge.className = "tb-pillFile";
    badge.textContent = node.kind || "Dataset";

    head.append(left, badge);
    panelViz.appendChild(head);

    if (!data) {
      const msg = document.createElement("div");
      msg.className = "tb-panel__empty";
      msg.innerHTML = `
        <p class="tb-panel__emptyBody">
          Could not parse this file in the browser. Check that it is an Excel workbook and accessible from this page.
        </p>
      `;
      panelViz.appendChild(msg);
      return;
    }

    const { header, rows, numericCols } = data;
    const layout = document.createElement("div");
    layout.className = "tb-vizLayout";

    const leftCol = document.createElement("div");
    leftCol.className = "tb-vizLeft";

    const metricBox = document.createElement("div");
    metricBox.className = "tb-metrics";

    if (numericCols.length) {
      const col = numericCols[0];
      const values = rows.map((r) => (typeof r[col] === "number" ? r[col] : null)).filter((v) => v != null);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = values.length ? sum / values.length : 0;
      const max = values.length ? Math.max(...values) : 0;

      [
        {
          label: `Sum of ${header[col] || "series"}`,
          value: sum.toLocaleString(undefined, { maximumFractionDigits: 1 }),
          hint: `Across ${values.length} rows`,
        },
        {
          label: "Average",
          value: avg.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          hint: "Mean of numeric values",
        },
        {
          label: "Maximum",
          value: max.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          hint: "Largest observed value",
        },
      ].forEach((m) => {
        const box = document.createElement("div");
        box.className = "tb-metric";
        box.innerHTML = `
          <div class="tb-metric__label">${m.label}</div>
          <div class="tb-metric__value">${m.value}</div>
          <div class="tb-metric__hint">${m.hint}</div>
        `;
        metricBox.appendChild(box);
      });
    }

    leftCol.appendChild(metricBox);

    if (numericCols.length) {
      const col = numericCols[0];
      const xLabels = rows.map((r) => r[0]);
      const values = rows.map((r) => (typeof r[col] === "number" ? r[col] : null));
      const validPoints = values
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v != null);

      if (validPoints.length) {
        const minVal = Math.min(...validPoints.map((p) => p.v));
        const maxVal = Math.max(...validPoints.map((p) => p.v));
        const span = maxVal - minVal || 1;

        const lineChart = document.createElement("div");
        lineChart.className = "tb-chart tb-chartLine";

        const pts = validPoints
          .map((p, idx) => {
            const x = (idx / Math.max(validPoints.length - 1, 1)) * 100;
            const y = 35 - ((p.v - minVal) / span) * 25;
            return `${x},${y}`;
          })
          .join(" ");

        lineChart.innerHTML = `
          <div class="tb-chart__title">Line chart from first numeric series</div>
          <p class="tb-chart__hint">X-axis follows row order; Y-axis uses the column "${header[col] || ""}".</p>
          <svg class="tb-lineSvg" viewBox="0 0 100 40" aria-hidden="true">
            <defs>
              <linearGradient id="tbGradientArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(139,182,255,0.6)" />
                <stop offset="100%" stop-color="rgba(139,182,255,0)" />
              </linearGradient>
            </defs>
            <polyline class="tb-lineBg" points="0,35 100,35" />
            <polyline class="tb-linePlot" fill="none" points="${pts}" />
          </svg>
        `;

        leftCol.appendChild(lineChart);
      }
    }

    const rightCol = document.createElement("div");

    if (numericCols.length) {
      const catCol = 0;
      const valCol = numericCols[0];
      const aggregates = new Map();
      rows.forEach((r) => {
        const k = r[catCol] == null ? "(blank)" : String(r[catCol]);
        const v = typeof r[valCol] === "number" ? r[valCol] : 0;
        aggregates.set(k, (aggregates.get(k) || 0) + v);
      });

      const sorted = Array.from(aggregates.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      const total = sorted.reduce((a, [, v]) => a + v, 0) || 1;
      const circumference = 2 * Math.PI * 20;

      const donutCard = document.createElement("div");
      donutCard.className = "tb-chart";

      let offset = 0;
      const segments = sorted
        .map(([label, value], idx) => {
          const frac = value / total;
          const dash = circumference * frac;
          const colorStops = ["#ff7aa2", "#8bb6ff", "#6be3c2", "#ffb347"];
          const dashOffset = circumference - offset - dash;
          offset += dash;
          return `<circle
            cx="30"
            cy="30"
            r="20"
            fill="none"
            stroke="${colorStops[idx % colorStops.length]}"
            stroke-width="8"
            stroke-dasharray="${dash}"
            stroke-dashoffset="${dashOffset}"
            stroke-linecap="butt"
          />`;
        })
        .join("");

      const legend = sorted
        .map(
          ([label, value], idx) =>
            `<span class="tb-fileChip">${label}: ${(value / total * 100).toFixed(1)}%</span>`,
        )
        .join("");

      donutCard.innerHTML = `
        <div class="tb-chart__title">Share by first column</div>
        <p class="tb-chart__hint">Relative share using "${header[0] || "category"}" against "${header[valCol] ||
          "value"}".</p>
        <div class="tb-chartDonut">
          <svg class="tb-donutSvg" viewBox="0 0 60 60" aria-hidden="true">
            <circle class="tb-donutTrack" cx="30" cy="30" r="20" />
            ${segments}
          </svg>
          <div>
            <div class="tb-donutLabel">Top categories</div>
            <div class="tb-files__list" style="margin-top: 4px;">${legend}</div>
          </div>
        </div>
      `;

      rightCol.appendChild(donutCard);
    }

    const filesCard = document.createElement("div");
    filesCard.className = "tb-files";
    filesCard.innerHTML = `
      <div class="tb-files__label">File info</div>
      <div class="tb-files__list">
        <span class="tb-fileChip">${node.path?.endsWith(".pdf") ? "PDF" : "Excel"}</span>
        <span class="tb-fileChip">${node.kind || "Dataset"}</span>
        <span class="tb-fileChip">${rows.length} data rows</span>
      </div>
      <div class="tb-pillNote">
        Path: <code>${node.path || "(set path in tuutuubee.js)"}</code>
      </div>
    `;
    rightCol.appendChild(filesCard);

    layout.append(leftCol, rightCol);
    panelViz.appendChild(layout);
  };

  const renderVizPanel = () => {
    const node = findNodeByPath(currentPath);

    if (node.type !== "file") {
      panelViz.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "tb-panel__empty";
      const title = document.createElement("h2");
      title.className = "tb-panel__emptyTitle";
      title.textContent = "Pick a data file to see its dashboard.";
      const body = document.createElement("p");
      body.className = "tb-panel__emptyBody";
      body.textContent =
        "When you click a file, this area loads charts directly from the Excel workbook.";
      wrap.append(title, body);
      panelViz.appendChild(wrap);
      return;
    }

    if (
      node.path ===
      "bulk-data/01_Domestic/01_Total_trips/UN_Tourism_domestic_trips_12_2025.xlsx"
    ) {
      // Use a slightly more curated layout for domestic trips but still based on real data.
      renderRealDataDashboard(node);
    } else if (node.path && node.path.endsWith(".xlsx")) {
      renderRealDataDashboard(node);
    } else {
      panelViz.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "tb-panel__empty";
      const title = document.createElement("h2");
      title.className = "tb-panel__emptyTitle";
      title.textContent = "No visualisation for this file type yet.";
      const body = document.createElement("p");
      body.className = "tb-panel__emptyBody";
      body.textContent =
        "Only Excel workbooks (.xlsx) are parsed for charts at the moment. PDFs and other types are listed as metadata only.";
      wrap.append(title, body);
      panelViz.appendChild(wrap);
    }
  };

  const render = () => {
    buildBreadcrumb();
    renderListPanel();
    renderVizPanel();
  };

  renderSidebar();
  render();
})();
