const STORAGE_KEY = "teacher-calibrated-discussion-dashboard-v1";

const features = [
  { key: "posts", label: "게시글 작성 횟수" },
  { key: "comments", label: "댓글 작성 횟수" },
  { key: "postLikesReceived", label: "자신의 게시글 좋아요 수" },
  { key: "likesGiven", label: "누른 좋아요 수" },
  { key: "commentLikesReceived", label: "자신의 댓글 좋아요 수" },
  { key: "questions", label: "질문 작성 횟수" },
  { key: "repliesToPeers", label: "동료에게 단 댓글 수" },
  { key: "evidenceMentions", label: "근거/자료 언급 횟수" },
];

const students = [
  { id: "S01", name: "김민서", posts: 5, comments: 12, postLikesReceived: 9, likesGiven: 14, commentLikesReceived: 7, questions: 4, repliesToPeers: 8, evidenceMentions: 5, teacherLabel: 1 },
  { id: "S02", name: "이준호", posts: 2, comments: 5, postLikesReceived: 2, likesGiven: 6, commentLikesReceived: 1, questions: 1, repliesToPeers: 3, evidenceMentions: 1, teacherLabel: 0 },
  { id: "S03", name: "박서연", posts: 4, comments: 10, postLikesReceived: 7, likesGiven: 11, commentLikesReceived: 6, questions: 3, repliesToPeers: 7, evidenceMentions: 4, teacherLabel: 1 },
  { id: "S04", name: "최도윤", posts: 1, comments: 4, postLikesReceived: 1, likesGiven: 3, commentLikesReceived: 1, questions: 2, repliesToPeers: 2, evidenceMentions: 0, teacherLabel: 0 },
  { id: "S05", name: "정하린", posts: 6, comments: 8, postLikesReceived: 10, likesGiven: 9, commentLikesReceived: 5, questions: 2, repliesToPeers: 5, evidenceMentions: 6, teacherLabel: 1 },
  { id: "S06", name: "강시우", posts: 3, comments: 3, postLikesReceived: 4, likesGiven: 4, commentLikesReceived: 1, questions: 0, repliesToPeers: 1, evidenceMentions: 2, teacherLabel: 0 },
  { id: "S07", name: "윤지아", posts: 4, comments: 13, postLikesReceived: 5, likesGiven: 16, commentLikesReceived: 9, questions: 5, repliesToPeers: 10, evidenceMentions: 3, teacherLabel: 1 },
  { id: "S08", name: "한태오", posts: 2, comments: 7, postLikesReceived: 2, likesGiven: 10, commentLikesReceived: 4, questions: 4, repliesToPeers: 6, evidenceMentions: 1, teacherLabel: 0 },
  { id: "S09", name: "오나윤", posts: 5, comments: 9, postLikesReceived: 8, likesGiven: 8, commentLikesReceived: 4, questions: 2, repliesToPeers: 4, evidenceMentions: 7, teacherLabel: 1 },
  { id: "S10", name: "임현우", posts: 1, comments: 2, postLikesReceived: 0, likesGiven: 2, commentLikesReceived: 0, questions: 1, repliesToPeers: 1, evidenceMentions: 0, teacherLabel: 0 },
  { id: "S11", name: "송유진", posts: 3, comments: 11, postLikesReceived: 5, likesGiven: 13, commentLikesReceived: 8, questions: 4, repliesToPeers: 9, evidenceMentions: 4, teacherLabel: 1 },
  { id: "S12", name: "문민재", posts: 2, comments: 6, postLikesReceived: 3, likesGiven: 5, commentLikesReceived: 2, questions: 2, repliesToPeers: 3, evidenceMentions: 1, teacherLabel: 0 },
  { id: "S13", name: "장아린", posts: 7, comments: 14, postLikesReceived: 12, likesGiven: 12, commentLikesReceived: 10, questions: 5, repliesToPeers: 11, evidenceMentions: 8, teacherLabel: 1 },
  { id: "S14", name: "배도현", posts: 2, comments: 9, postLikesReceived: 4, likesGiven: 14, commentLikesReceived: 6, questions: 5, repliesToPeers: 8, evidenceMentions: 2, teacherLabel: 1 },
  { id: "S15", name: "신예린", posts: 1, comments: 5, postLikesReceived: 1, likesGiven: 8, commentLikesReceived: 2, questions: 3, repliesToPeers: 5, evidenceMentions: 0, teacherLabel: 0 },
  { id: "S16", name: "고서준", posts: 4, comments: 4, postLikesReceived: 8, likesGiven: 3, commentLikesReceived: 2, questions: 1, repliesToPeers: 2, evidenceMentions: 5, teacherLabel: 1 },
  { id: "S17", name: "양수빈", posts: 3, comments: 8, postLikesReceived: 6, likesGiven: 9, commentLikesReceived: 5, questions: 3, repliesToPeers: 7, evidenceMentions: 3, teacherLabel: 1 },
  { id: "S18", name: "조하준", posts: 0, comments: 3, postLikesReceived: 0, likesGiven: 4, commentLikesReceived: 1, questions: 1, repliesToPeers: 2, evidenceMentions: 0, teacherLabel: 0 },
  { id: "S19", name: "남채원", posts: 5, comments: 6, postLikesReceived: 9, likesGiven: 7, commentLikesReceived: 3, questions: 1, repliesToPeers: 4, evidenceMentions: 6, teacherLabel: 1 },
  { id: "S20", name: "홍지후", posts: 2, comments: 4, postLikesReceived: 2, likesGiven: 6, commentLikesReceived: 2, questions: 2, repliesToPeers: 3, evidenceMentions: 1, teacherLabel: 0 },
];

let state = loadState();
let model = trainModel();
let adjustedWeights = [...model.weights];

const nodes = {
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  labelingHead: document.querySelector("#labeling-head"),
  labelingBody: document.querySelector("#labeling-body"),
  predictionBody: document.querySelector("#prediction-body"),
  adjustedBody: document.querySelector("#adjusted-body"),
  trainModel: document.querySelector("#train-model"),
  restoreWeights: document.querySelector("#restore-weights"),
  resetApp: document.querySelector("#reset-app"),
  downloadCsv: document.querySelector("#download-csv"),
  studentCount: document.querySelector("#student-count"),
  passCount: document.querySelector("#pass-count"),
  failCount: document.querySelector("#fail-count"),
  modelStatus: document.querySelector("#model-status"),
  formulaText: document.querySelector("#formula-text"),
  accuracy: document.querySelector("#accuracy"),
  intercept: document.querySelector("#intercept"),
  coefficientList: document.querySelector("#coefficient-list"),
  positiveCorrelations: document.querySelector("#positive-correlations"),
  negativeCorrelations: document.querySelector("#negative-correlations"),
  sliderList: document.querySelector("#slider-list"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { labels: Object.fromEntries(students.map((student) => [student.id, student.teacherLabel])) };

  try {
    return JSON.parse(saved);
  } catch {
    return { labels: Object.fromEntries(students.map((student) => [student.id, student.teacherLabel])) };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function labels() {
  return students.map((student) => Number(state.labels[student.id]));
}

function featureMatrix() {
  const means = {};
  const stds = {};

  features.forEach((feature) => {
    const values = students.map((student) => student[feature.key]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    means[feature.key] = mean;
    stds[feature.key] = Math.sqrt(variance) || 1;
  });

  const rows = students.map((student) =>
    features.map((feature) => (student[feature.key] - means[feature.key]) / stds[feature.key]),
  );

  return { rows, means, stds };
}

function trainModel() {
  const { rows, means, stds } = featureMatrix();
  const y = labels();
  const weights = Array(features.length).fill(0);
  let bias = 0;
  const learningRate = 0.12;
  const l2 = 0.015;

  for (let epoch = 0; epoch < 1800; epoch += 1) {
    const grad = Array(features.length).fill(0);
    let biasGrad = 0;

    rows.forEach((row, index) => {
      const prediction = sigmoid(dot(row, weights) + bias);
      const error = prediction - y[index];
      row.forEach((value, featureIndex) => {
        grad[featureIndex] += error * value;
      });
      biasGrad += error;
    });

    weights.forEach((weight, index) => {
      weights[index] -= learningRate * (grad[index] / rows.length + l2 * weight);
    });
    bias -= learningRate * (biasGrad / rows.length);
  }

  const predictions = rows.map((row) => sigmoid(dot(row, weights) + bias));
  const accuracy =
    predictions.filter((value, index) => Number(value >= 0.5) === y[index]).length / predictions.length;

  return { weights, bias, means, stds, predictions, accuracy };
}

function retrain() {
  model = trainModel();
  adjustedWeights = [...model.weights];
  saveState();
  render();
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function dot(row, weights) {
  return row.reduce((sum, value, index) => sum + value * weights[index], 0);
}

function predict(student, weights = model.weights, bias = model.bias) {
  const row = features.map((feature) => (student[feature.key] - model.means[feature.key]) / model.stds[feature.key]);
  return sigmoid(dot(row, weights) + bias);
}

function correlations() {
  const y = labels();
  return features
    .map((feature, index) => {
      const x = students.map((student) => student[feature.key]);
      return { ...feature, index, correlation: pearson(x, y) };
    })
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

function pearson(x, y) {
  const meanX = average(x);
  const meanY = average(y);
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  x.forEach((value, index) => {
    const dx = value - meanX;
    const dy = y[index] - meanY;
    numerator += dx * dy;
    denomX += dx ** 2;
    denomY += dy ** 2;
  });

  return numerator / (Math.sqrt(denomX * denomY) || 1);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function render() {
  renderSummary();
  renderLabelingTable();
  renderModel();
  renderAdjustment();
}

function renderSummary() {
  const pass = labels().filter(Boolean).length;
  nodes.studentCount.textContent = String(students.length);
  nodes.passCount.textContent = String(pass);
  nodes.failCount.textContent = String(students.length - pass);
  nodes.modelStatus.textContent = `${Math.round(model.accuracy * 100)}%`;
}

function renderLabelingTable() {
  nodes.labelingHead.innerHTML = `
    <tr>
      <th>학생</th>
      ${features.map((feature) => `<th>${feature.label}</th>`).join("")}
      <th>교사 판단</th>
    </tr>
  `;

  nodes.labelingBody.innerHTML = students
    .map(
      (student) => `
        <tr>
          <td class="student-name">${student.name}</td>
          ${features.map((feature) => `<td>${student[feature.key]}</td>`).join("")}
          <td>
            <div class="segmented" aria-label="${student.name} 판단">
              <button class="choice pass ${state.labels[student.id] === 1 ? "active" : ""}" type="button" data-label="${student.id}" data-value="1">Pass</button>
              <button class="choice fail ${state.labels[student.id] === 0 ? "active" : ""}" type="button" data-label="${student.id}" data-value="0">Fail</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderModel() {
  nodes.formulaText.textContent = buildFormula(model.weights, model.bias);
  nodes.accuracy.textContent = `${Math.round(model.accuracy * 100)}%`;
  nodes.intercept.textContent = model.bias.toFixed(3);
  nodes.coefficientList.innerHTML = features
    .map((feature, index) => coefficientItem(feature, model.weights[index]))
    .join("");

  nodes.predictionBody.innerHTML = students
    .map((student) => {
      const probability = predict(student);
      const predicted = Number(probability >= 0.5);
      const actual = state.labels[student.id];
      return `
        <tr>
          <td class="student-name">${student.name}</td>
          <td>${badge(actual)}</td>
          <td>${formatProbability(probability)}</td>
          <td>${badge(predicted)}</td>
          <td>${predicted === actual ? "일치" : "불일치"}</td>
        </tr>
      `;
    })
    .join("");
}

function buildFormula(weights, bias) {
  const terms = weights.map((weight, index) => `${signed(weight)} * z(${features[index].label})`);
  return `P(Pass) = sigmoid(${bias.toFixed(3)} ${terms.join(" ")})`;
}

function coefficientItem(feature, weight) {
  const width = Math.min(100, Math.abs(weight) * 28);
  const color = weight >= 0 ? "var(--green)" : "var(--red)";
  return `
    <article class="coef-item">
      <div class="coef-row">
        <span>${feature.label}</span>
        <span>${weight.toFixed(3)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width: ${width}%; background: ${color}"></div></div>
    </article>
  `;
}

function renderAdjustment() {
  const corr = correlations();
  const positive = corr.filter((item) => item.correlation >= 0).sort((a, b) => b.correlation - a.correlation);
  const negative = corr.filter((item) => item.correlation < 0).sort((a, b) => a.correlation - b.correlation);

  nodes.positiveCorrelations.innerHTML = positive.map(correlationItem).join("");
  nodes.negativeCorrelations.innerHTML = negative.map(correlationItem).join("") || `<p class="muted">음의 상관 변수가 없습니다.</p>`;
  nodes.sliderList.innerHTML = corr.map(sliderItem).join("");
  renderAdjustedPredictions();
}

function renderAdjustedPredictions() {
  nodes.adjustedBody.innerHTML = students
    .map((student) => {
      const original = Number(predict(student, model.weights) >= 0.5);
      const adjusted = predict(student, adjustedWeights);
      const adjustedLabel = Number(adjusted >= 0.5);
      return `
        <tr>
          <td class="student-name">${student.name}</td>
          <td>${formatProbability(adjusted)}</td>
          <td>${badge(adjustedLabel)}</td>
          <td>${badge(state.labels[student.id])}</td>
          <td class="${original !== adjustedLabel ? "changed" : ""}">${original !== adjustedLabel ? "변경됨" : "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function correlationItem(item) {
  const width = Math.round(Math.abs(item.correlation) * 100);
  const color = item.correlation >= 0 ? "var(--green)" : "var(--red)";
  return `
    <article class="correlation-item">
      <div class="correlation-row">
        <span>${item.label}</span>
        <span>r = ${item.correlation.toFixed(3)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width: ${width}%; background: ${color}"></div></div>
    </article>
  `;
}

function sliderItem(item) {
  const index = item.index;
  const value = adjustedWeights[index];
  return `
    <article class="slider-item">
      <div class="slider-row">
        <span>${item.label} <span class="muted">r=${item.correlation.toFixed(3)}</span></span>
        <output id="weight-out-${index}">${value.toFixed(2)}</output>
      </div>
      <div class="slider-row">
        <input type="range" min="-4" max="4" step="0.05" value="${value}" data-weight-index="${index}" />
      </div>
    </article>
  `;
}

function badge(value) {
  return `<span class="badge ${value ? "pass" : "fail"}">${value ? "Pass" : "Fail"}</span>`;
}

function formatProbability(value) {
  return `${Math.round(value * 100)}%`;
}

function signed(value) {
  return `${value >= 0 ? "+" : "-"} ${Math.abs(value).toFixed(3)}`;
}

function csvText() {
  const header = ["student_id", "student_name", ...features.map((feature) => feature.key), "teacher_label"];
  const rows = students.map((student) => [
    student.id,
    student.name,
    ...features.map((feature) => student[feature.key]),
    state.labels[student.id],
  ]);
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}

nodes.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;
    nodes.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    nodes.views.forEach((item) => item.classList.toggle("active", item.id === `${view}-view`));
  });
});

nodes.labelingBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-label]");
  if (!button) return;
  state.labels[button.dataset.label] = Number(button.dataset.value);
  saveState();
  render();
});

nodes.trainModel.addEventListener("click", retrain);

nodes.sliderList.addEventListener("input", (event) => {
  const input = event.target.closest("[data-weight-index]");
  if (!input) return;
  const index = Number(input.dataset.weightIndex);
  adjustedWeights[index] = Number(input.value);
  document.querySelector(`#weight-out-${index}`).textContent = adjustedWeights[index].toFixed(2);
  renderAdjustedPredictions();
});

nodes.restoreWeights.addEventListener("click", () => {
  adjustedWeights = [...model.weights];
  renderAdjustment();
});

nodes.resetApp.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  model = trainModel();
  adjustedWeights = [...model.weights];
  render();
});

nodes.downloadCsv.addEventListener("click", () => {
  const blob = new Blob([csvText()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dummy_discussion_logs.csv";
  link.click();
  URL.revokeObjectURL(url);
});

render();
