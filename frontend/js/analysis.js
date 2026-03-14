document.addEventListener("DOMContentLoaded", function () {
    const API = "http://localhost:5000/api";
    const token = localStorage.getItem("token");
    const ANALYSIS_STORAGE_KEY = "pa_analysis_report";
    const FORECAST_STORAGE_KEY = "pa_forecast_report";

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    initializeDownloadButtons(
        getStoredReport(ANALYSIS_STORAGE_KEY),
        getStoredReport(FORECAST_STORAGE_KEY)
    );

    const analyzeBtn = document.getElementById("analyzeBtn");
    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", async function () {
            const fileInput = document.getElementById("fileInput");
            const file = fileInput.files[0];

            if (!file) {
                alert("Please select a CSV file.");
                return;
            }

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(API + "/analyze-file", {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                alert(data.error || data.msg);
                return;
            }

            updateDashboard(data);
            const report = storeAnalysisReport(data, ANALYSIS_STORAGE_KEY);
            initializeDownloadButtons(report, getStoredReport(FORECAST_STORAGE_KEY));
        });
    }

    const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener("click", function () {
            downloadAnalysisTemplate();
        });
    }

    let fullLabels = [];
    let fullSales = [];
    let fullProfit = [];

    const forecastBtn = document.getElementById("forecastBtn");
    if (forecastBtn) {
        forecastBtn.addEventListener("click", async function () {
            const fileInput = document.getElementById("fileInput");
            const file = fileInput.files[0];

            if (!file) {
                alert("Please upload a CSV file first.");
                return;
            }

            setText("forecastNote", "Running model forecast...");

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(API + "/forecast", {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                setText("forecastNote", data.error || "Forecast failed.");
                alert(data.error || data.msg);
                return;
            }

            fullLabels = data.future_dates_180 || data.future_days_180 || [];
            fullSales = data.sales_6_months || [];
            fullProfit = data.profit_6_months || [];

            setModelStatus(data.models_loaded);
            setText("forecastNote", "Model forecast generated successfully.");
            updateForecastCharts();
            updateCategoryBreakdown(data.category_breakdown);

            let report = storeForecastReport(data, FORECAST_STORAGE_KEY);
            setTimeout(() => {
                const imageReport = attachForecastImagesToStoredReport(FORECAST_STORAGE_KEY);
                report = imageReport || report;
                initializeDownloadButtons(getStoredReport(ANALYSIS_STORAGE_KEY), report);
            }, 450);
        });
    }

    const salesDuration = document.getElementById("salesDuration");
    const profitDuration = document.getElementById("profitDuration");
    const cumulativeSalesDuration = document.getElementById("cumulativeSalesDuration");
    const cumulativeProfitDuration = document.getElementById("cumulativeProfitDuration");

    [salesDuration, profitDuration, cumulativeSalesDuration, cumulativeProfitDuration].forEach(
        (select) => {
            if (select) {
                select.addEventListener("change", function () {
                    updateForecastCharts();
                });
            }
        }
    );

    function updateForecastCharts() {
        if (fullLabels.length === 0) {
            return;
        }

        const salesDur = parseInt(salesDuration?.value || 180, 10);
        const salesLabels = fullLabels.slice(0, salesDur);
        const salesData = fullSales.slice(0, salesDur);
        renderChart("salesChart", salesLabels, salesData, "Sales Forecast");

        const profitDur = parseInt(profitDuration?.value || 180, 10);
        const profitLabels = fullLabels.slice(0, profitDur);
        const profitData = fullProfit.slice(0, profitDur);
        renderChart("profitChart", profitLabels, profitData, "Profit Forecast");

        const cumSalesDur = parseInt(cumulativeSalesDuration?.value || 180, 10);
        const cumSalesLabels = fullLabels.slice(0, cumSalesDur);
        const cumSalesRaw = fullSales.slice(0, cumSalesDur);
        const cumulativeSales = [];
        let runningSales = 0;
        cumSalesRaw.forEach((value) => {
            runningSales += value;
            cumulativeSales.push(runningSales);
        });
        renderChart(
            "cumulativeSalesChart",
            cumSalesLabels,
            cumulativeSales,
            "Cumulative Revenue Growth"
        );

        const cumProfitDur = parseInt(cumulativeProfitDuration?.value || 180, 10);
        const cumProfitLabels = fullLabels.slice(0, cumProfitDur);
        const cumProfitRaw = fullProfit.slice(0, cumProfitDur);
        const cumulativeProfit = [];
        let runningProfit = 0;
        cumProfitRaw.forEach((value) => {
            runningProfit += value;
            cumulativeProfit.push(runningProfit);
        });
        renderChart(
            "cumulativeProfitChart",
            cumProfitLabels,
            cumulativeProfit,
            "Cumulative Profit Growth"
        );
    }

    function updateCategoryBreakdown(categoryBreakdown) {
        const box = document.getElementById("categoryBox");
        const outputElement = document.getElementById("categoryResult");
        if (!box || !outputElement) {
            return;
        }

        if (!categoryBreakdown || Object.keys(categoryBreakdown).length === 0) {
            box.style.display = "none";
            outputElement.innerText = "";
            return;
        }

        box.style.display = "block";
        const lines = [];
        for (const category in categoryBreakdown) {
            const value = Math.round(categoryBreakdown[category]).toLocaleString();
            lines.push(`${category} - Rs ${value}`);
        }
        outputElement.innerText = lines.join("\n");
    }

    function setModelStatus(modelsLoaded) {
        if (!modelsLoaded) {
            setText("modelStatus", "Model status unavailable.");
            return;
        }

        const salesOk = modelsLoaded.sales_model ? "loaded" : "not loaded";
        const profitOk = modelsLoaded.profit_model ? "loaded" : "not loaded";
        setText("modelStatus", `Sales model: ${salesOk} | Profit model: ${profitOk}`);
    }

    function updateDashboard(data) {
        setText("rev", "Rs " + data.total_revenue.toLocaleString());
        setText("profit", "Rs " + data.total_profit.toLocaleString());
        setText("margin", data.profit_margin + " %");
        setText("avg", "Rs " + data.avg_order_value);
        setText("mean", data.mean_revenue);
        setText("median", data.median_revenue);
        setText("std", data.std_revenue);
        setText("maxday", data.max_day);
        setText("minday", data.min_day);

        setHtml("monthlyChart", `<img src="data:image/png;base64,${data.monthly_plot}" width="700"/>`);
        setHtml("pieChart", `<img src="data:image/png;base64,${data.pie_plot}" width="500"/>`);
        setHtml("corrChart", `<img src="data:image/png;base64,${data.corr_plot}" width="500"/>`);

        setText("topRevenue", formatRanking(data.top3_revenue, "Rs"));
        setText("topProfit", formatRanking(data.top3_profit, "Rs"));
        setText("bottomProfit", formatRanking(data.bottom3_profit, "Rs"));
        setText("insight", data.insight || "No insight generated.");
    }
});

function initializeDownloadButtons(analysisReport, forecastReport) {
    const analysisPdfBtn = document.getElementById("downloadAnalysisPdfBtn");
    const analysisDocBtn = document.getElementById("downloadAnalysisDocBtn");
    const forecastPdfBtn = document.getElementById("downloadForecastPdfBtn");
    const forecastDocBtn = document.getElementById("downloadForecastDocBtn");

    const hasAnalysis = !!analysisReport;
    const hasForecast = !!forecastReport;

    if (analysisPdfBtn) {
        analysisPdfBtn.disabled = !hasAnalysis;
        analysisPdfBtn.onclick = function () {
            const report = getStoredReport("pa_analysis_report");
            if (!report) {
                alert("Run analysis first, then download.");
                return;
            }
            downloadAnalysisPdf(report);
        };
    }

    if (analysisDocBtn) {
        analysisDocBtn.disabled = !hasAnalysis;
        analysisDocBtn.onclick = function () {
            const report = getStoredReport("pa_analysis_report");
            if (!report) {
                alert("Run analysis first, then download.");
                return;
            }
            downloadAnalysisDoc(report);
        };
    }

    if (forecastPdfBtn) {
        forecastPdfBtn.disabled = !hasForecast;
        forecastPdfBtn.onclick = function () {
            const report = getStoredReport("pa_forecast_report");
            if (!report) {
                alert("Run forecast first, then download.");
                return;
            }
            downloadForecastPdf(report);
        };
    }

    if (forecastDocBtn) {
        forecastDocBtn.disabled = !hasForecast;
        forecastDocBtn.onclick = function () {
            const report = getStoredReport("pa_forecast_report");
            if (!report) {
                alert("Run forecast first, then download.");
                return;
            }
            downloadForecastDoc(report);
        };
    }
}

function storeAnalysisReport(data, key) {
    const report = {
        generated_at: new Date().toISOString(),
        total_revenue: data.total_revenue,
        total_profit: data.total_profit,
        profit_margin: data.profit_margin,
        avg_order_value: data.avg_order_value,
        mean_revenue: data.mean_revenue,
        median_revenue: data.median_revenue,
        std_revenue: data.std_revenue,
        max_day: data.max_day,
        min_day: data.min_day,
        top3_revenue: data.top3_revenue || {},
        top3_profit: data.top3_profit || {},
        bottom3_profit: data.bottom3_profit || {},
        insight: data.insight || "",
        chart_images: {
            monthly_trend: ensureDataUrl(data.monthly_plot),
            revenue_contribution: ensureDataUrl(data.pie_plot),
            correlation_heatmap: ensureDataUrl(data.corr_plot),
        },
    };
    localStorage.setItem(key, JSON.stringify(report));
    return report;
}

function storeForecastReport(data, key) {
    const labels = data.future_dates_180 || data.future_days_180 || [];
    const sales = data.sales_6_months || [];
    const profit = data.profit_6_months || [];
    const report = {
        generated_at: new Date().toISOString(),
        labels: labels,
        sales: sales,
        profit: profit,
        models_loaded: data.models_loaded || {},
        category_breakdown: data.category_breakdown || {},
        total_sales_forecast: sales.reduce((sum, value) => sum + (Number(value) || 0), 0),
        total_profit_forecast: profit.reduce((sum, value) => sum + (Number(value) || 0), 0),
        chart_images: {},
    };
    localStorage.setItem(key, JSON.stringify(report));
    return report;
}

function attachForecastImagesToStoredReport(key) {
    const report = getStoredReport(key);
    if (!report) {
        return null;
    }

    report.chart_images = buildForecastChartImages(report);
    localStorage.setItem(key, JSON.stringify(report));
    return report;
}

function getStoredReport(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function downloadAnalysisPdf(report) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF library failed to load. Refresh the page and try again.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const lines = [
        `Generated At: ${formatIsoDate(report.generated_at)}`,
        "",
        "Summary",
        `Total Revenue: ${formatCurrency(report.total_revenue)}`,
        `Total Profit: ${formatCurrency(report.total_profit)}`,
        `Profit Margin: ${report.profit_margin}%`,
        `Avg Order Value: ${formatCurrency(report.avg_order_value)}`,
        "",
        "Statistics",
        `Mean Revenue: ${report.mean_revenue}`,
        `Median Revenue: ${report.median_revenue}`,
        `Standard Deviation: ${report.std_revenue}`,
        `Highest Revenue Day: ${report.max_day}`,
        `Lowest Revenue Day: ${report.min_day}`,
        "",
        "Top 3 Revenue Products",
        ...toRankingLines(report.top3_revenue),
        "",
        "Top 3 Profit Products",
        ...toRankingLines(report.top3_profit),
        "",
        "Bottom 3 Profit Products",
        ...toRankingLines(report.bottom3_profit),
        "",
        `Insight: ${report.insight || "No insight generated."}`,
    ];

    writePdfLines(doc, "Business Analysis Report", lines);
    const chartImages = report.chart_images || captureAnalysisImagesFromDom();
    addPdfImages(doc, "Analysis Charts", [
        chartImages.monthly_trend,
        chartImages.revenue_contribution,
        chartImages.correlation_heatmap,
    ]);
    doc.save(`analysis-report-${buildDateStamp()}.pdf`);
}

function downloadAnalysisDoc(report) {
    const html = `
        <html>
        <head><meta charset="utf-8"><title>Business Analysis Report</title></head>
        <body>
            <h1>Business Analysis Report</h1>
            <p><strong>Generated At:</strong> ${escapeHtml(formatIsoDate(report.generated_at))}</p>
            <h2>Summary</h2>
            <p><strong>Total Revenue:</strong> ${escapeHtml(formatCurrency(report.total_revenue))}</p>
            <p><strong>Total Profit:</strong> ${escapeHtml(formatCurrency(report.total_profit))}</p>
            <p><strong>Profit Margin:</strong> ${escapeHtml(`${report.profit_margin}%`)}</p>
            <p><strong>Avg Order Value:</strong> ${escapeHtml(formatCurrency(report.avg_order_value))}</p>
            <h2>Statistics</h2>
            <p><strong>Mean Revenue:</strong> ${escapeHtml(String(report.mean_revenue))}</p>
            <p><strong>Median Revenue:</strong> ${escapeHtml(String(report.median_revenue))}</p>
            <p><strong>Standard Deviation:</strong> ${escapeHtml(String(report.std_revenue))}</p>
            <p><strong>Highest Revenue Day:</strong> ${escapeHtml(String(report.max_day))}</p>
            <p><strong>Lowest Revenue Day:</strong> ${escapeHtml(String(report.min_day))}</p>
            <h2>Top 3 Revenue Products</h2>
            ${renderRankingHtml(report.top3_revenue)}
            <h2>Top 3 Profit Products</h2>
            ${renderRankingHtml(report.top3_profit)}
            <h2>Bottom 3 Profit Products</h2>
            ${renderRankingHtml(report.bottom3_profit)}
            <h2>Business Insight</h2>
            <p>${escapeHtml(report.insight || "No insight generated.")}</p>
        </body>
        </html>
    `;
    downloadDocBlob(html, `analysis-report-${buildDateStamp()}.doc`);
}

function downloadForecastPdf(report) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF library failed to load. Refresh the page and try again.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const totalDays = report.labels?.length || 0;
    const avgSales = totalDays > 0 ? report.total_sales_forecast / totalDays : 0;
    const avgProfit = totalDays > 0 ? report.total_profit_forecast / totalDays : 0;

    const lines = [
        `Generated At: ${formatIsoDate(report.generated_at)}`,
        "",
        "Forecast Summary",
        `Days Forecasted: ${totalDays}`,
        `Total Forecasted Sales: ${formatCurrency(report.total_sales_forecast)}`,
        `Total Forecasted Profit: ${formatCurrency(report.total_profit_forecast)}`,
        `Average Daily Sales: ${formatCurrency(avgSales)}`,
        `Average Daily Profit: ${formatCurrency(avgProfit)}`,
        "",
        "Model Status",
        `Sales model: ${report.models_loaded?.sales_model ? "loaded" : "not loaded"}`,
        `Profit model: ${report.models_loaded?.profit_model ? "loaded" : "not loaded"}`,
        "",
        "Category Breakdown",
        ...toCategoryLines(report.category_breakdown),
        "",
        "Sample Forecast (First 30 Days)",
        ...toForecastSampleLines(report.labels, report.sales, report.profit, 30),
    ];

    writePdfLines(doc, "Business Forecast Report", lines);
    const chartImages = hasCompleteForecastChartImages(report.chart_images)
        ? report.chart_images
        : buildForecastChartImages(report);
    addPdfImages(doc, "Forecast Charts", getForecastChartImageEntries(chartImages));
    doc.save(`forecast-report-${buildDateStamp()}.pdf`);
}

function captureAnalysisImagesFromDom() {
    const monthly = document.querySelector("#monthlyChart img");
    const pie = document.querySelector("#pieChart img");
    const corr = document.querySelector("#corrChart img");
    return {
        monthly_trend: monthly?.src || "",
        revenue_contribution: pie?.src || "",
        correlation_heatmap: corr?.src || "",
    };
}

function captureForecastImagesFromDom() {
    const salesCanvas = document.querySelector("#salesChart canvas");
    const profitCanvas = document.querySelector("#profitChart canvas");
    const cumulativeSalesCanvas = document.querySelector("#cumulativeSalesChart canvas");
    const cumulativeProfitCanvas = document.querySelector("#cumulativeProfitChart canvas");
    return {
        sales_forecast: salesCanvas ? salesCanvas.toDataURL("image/png") : "",
        profit_forecast: profitCanvas ? profitCanvas.toDataURL("image/png") : "",
        cumulative_sales_forecast: cumulativeSalesCanvas
            ? cumulativeSalesCanvas.toDataURL("image/png")
            : "",
        cumulative_profit_forecast: cumulativeProfitCanvas
            ? cumulativeProfitCanvas.toDataURL("image/png")
            : "",
    };
}

function downloadForecastDoc(report) {
    const totalDays = report.labels?.length || 0;
    const avgSales = totalDays > 0 ? report.total_sales_forecast / totalDays : 0;
    const avgProfit = totalDays > 0 ? report.total_profit_forecast / totalDays : 0;
    const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>Business Forecast Report</title>
            <!--[if gte mso 9]>
            <xml>
                <w:WordDocument>
                    <w:View>Print</w:View>
                    <w:Zoom>100</w:Zoom>
                </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                body { font-family: Calibri, Arial, sans-serif; }
                table { border-collapse: collapse; }
                th, td { border: 1px solid #777; padding: 6px; }
                img { max-width: 100%; height: auto; border: 1px solid #ccc; }
                .chart-block { margin: 12px 0 18px; page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <h1>Business Forecast Report</h1>
            <p><strong>Generated At:</strong> ${escapeHtml(formatIsoDate(report.generated_at))}</p>
            <h2>Forecast Summary</h2>
            <p><strong>Days Forecasted:</strong> ${totalDays}</p>
            <p><strong>Total Forecasted Sales:</strong> ${escapeHtml(formatCurrency(report.total_sales_forecast))}</p>
            <p><strong>Total Forecasted Profit:</strong> ${escapeHtml(formatCurrency(report.total_profit_forecast))}</p>
            <p><strong>Average Daily Sales:</strong> ${escapeHtml(formatCurrency(avgSales))}</p>
            <p><strong>Average Daily Profit:</strong> ${escapeHtml(formatCurrency(avgProfit))}</p>
            <h2>Model Status</h2>
            <p><strong>Sales model:</strong> ${report.models_loaded?.sales_model ? "loaded" : "not loaded"}</p>
            <p><strong>Profit model:</strong> ${report.models_loaded?.profit_model ? "loaded" : "not loaded"}</p>
            <h2>Category Breakdown</h2>
            ${renderCategoryHtml(report.category_breakdown)}
            <h2>Sample Forecast (First 30 Days)</h2>
            ${renderForecastTableHtml(report.labels, report.sales, report.profit, 30)}
        </body>
        </html>
    `;
    downloadDocBlob(html, `forecast-report-${buildDateStamp()}.doc`);
}

function writePdfLines(doc, title, lines) {
    const marginX = 12;
    const marginY = 14;
    const lineHeight = 7;
    const maxWidth = 185;
    let y = marginY;

    doc.setFontSize(16);
    doc.text(title, marginX, y);
    y += 10;

    doc.setFontSize(11);
    lines.forEach((line) => {
        const wrapped = doc.splitTextToSize(String(line), maxWidth);
        wrapped.forEach((wrappedLine) => {
            if (y > 285) {
                doc.addPage();
                y = marginY;
            }
            doc.text(wrappedLine, marginX, y);
            y += lineHeight;
        });
    });
}

function addPdfImages(doc, sectionTitle, images) {
    const validImages = (images || [])
        .map((item, index) =>
            typeof item === "string"
                ? { image: item, title: `${sectionTitle} ${index + 1}` }
                : item
        )
        .filter((item) => typeof item.image === "string" && item.image.length > 0);
    validImages.forEach((item, index) => {
        doc.addPage();
        doc.setFontSize(14);
        doc.text(item.title || `${sectionTitle} ${index + 1}`, 12, 14);

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxWidth = pageWidth - 24;
        const maxHeight = pageHeight - 30;

        try {
            const imageType = item.image.includes("image/jpeg") ? "JPEG" : "PNG";
            const props = doc.getImageProperties(item.image);
            let width = maxWidth;
            let height = (props.height * width) / props.width;

            if (height > maxHeight) {
                height = maxHeight;
                width = (props.width * height) / props.height;
            }

            const x = (pageWidth - width) / 2;
            doc.addImage(item.image, imageType, x, 20, width, height);
        } catch {
            doc.setFontSize(11);
            doc.text("Chart image could not be rendered.", 12, 26);
        }
    });
}

function getForecastDurationConfigs() {
    return [
        { key: "1_month", days: 30, label: "1 Month" },
        { key: "2_months", days: 60, label: "2 Months" },
        { key: "6_months", days: 180, label: "6 Months" },
    ];
}

function buildForecastChartImages(report) {
    const chartImages = {};
    getForecastChartDefinitions(report).forEach((definition) => {
        chartImages[definition.key] = renderChartImage(
            definition.labels,
            definition.values,
            definition.title
        );
    });
    return chartImages;
}

function hasCompleteForecastChartImages(chartImages) {
    if (!chartImages) {
        return false;
    }

    return getForecastChartDefinitions({ labels: [], sales: [], profit: [] }).every(
        (definition) => typeof chartImages[definition.key] === "string" && chartImages[definition.key].length > 0
    );
}

function getForecastChartDefinitions(report) {
    const labels = report.labels || [];
    const sales = report.sales || [];
    const profit = report.profit || [];
    const definitions = [];

    getForecastDurationConfigs().forEach((duration) => {
        const scopedLabels = labels.slice(0, duration.days);
        const scopedSales = sales.slice(0, duration.days);
        const scopedProfit = profit.slice(0, duration.days);

        definitions.push({
            key: `sales_forecast_${duration.key}`,
            title: `Sales Forecast (${duration.label})`,
            labels: scopedLabels,
            values: scopedSales,
        });
        definitions.push({
            key: `profit_forecast_${duration.key}`,
            title: `Profit Forecast (${duration.label})`,
            labels: scopedLabels,
            values: scopedProfit,
        });
        definitions.push({
            key: `cumulative_sales_forecast_${duration.key}`,
            title: `Cumulative Revenue Growth (${duration.label})`,
            labels: scopedLabels,
            values: buildCumulativeSeries(scopedSales),
        });
        definitions.push({
            key: `cumulative_profit_forecast_${duration.key}`,
            title: `Cumulative Profit Growth (${duration.label})`,
            labels: scopedLabels,
            values: buildCumulativeSeries(scopedProfit),
        });
    });

    return definitions;
}

function buildCumulativeSeries(values) {
    const cumulative = [];
    let runningTotal = 0;
    (values || []).forEach((value) => {
        runningTotal += Number(value) || 0;
        cumulative.push(runningTotal);
    });
    return cumulative;
}

function renderChartImage(labels, values, label) {
    if (!window.Chart || !values || values.length === 0) {
        return "";
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 600;

    const chart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: label,
                    data: values,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: "rgba(34,197,94,0.15)",
                    borderColor: "rgba(34,197,94,1)",
                    pointRadius: 2,
                },
            ],
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        font: { size: 14 },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { maxTicksLimit: 15 },
                },
            },
        },
    });

    chart.update("none");
    const image = canvas.toDataURL("image/png");
    chart.destroy();
    return image;
}

function getForecastChartImageEntries(chartImages) {
    return getForecastChartDefinitions({
        labels: [],
        sales: [],
        profit: [],
    }).map((definition) => ({
        title: definition.title,
        image: chartImages?.[definition.key] || "",
    }));
}

function toRankingLines(items) {
    if (!items || Object.keys(items).length === 0) {
        return ["No data available."];
    }
    const lines = [];
    let i = 1;
    for (const [name, value] of Object.entries(items)) {
        lines.push(`${i}. ${name}: ${formatCurrency(value)}`);
        i += 1;
    }
    return lines;
}

function toCategoryLines(categories) {
    if (!categories || Object.keys(categories).length === 0) {
        return ["No category breakdown available."];
    }
    const lines = [];
    for (const [name, value] of Object.entries(categories)) {
        lines.push(`${name}: ${formatCurrency(value)}`);
    }
    return lines;
}

function toForecastSampleLines(labels, sales, profit, limit) {
    if (!labels || labels.length === 0) {
        return ["No forecast data available."];
    }

    const lines = [];
    const rowCount = Math.min(limit, labels.length);
    for (let i = 0; i < rowCount; i += 1) {
        lines.push(
            `${labels[i]} | Sales: ${formatCurrency(sales[i])} | Profit: ${formatCurrency(profit[i])}`
        );
    }
    return lines;
}

function renderRankingHtml(items) {
    if (!items || Object.keys(items).length === 0) {
        return "<p>No data available.</p>";
    }
    let html = "<ol>";
    for (const [name, value] of Object.entries(items)) {
        html += `<li>${escapeHtml(name)}: ${escapeHtml(formatCurrency(value))}</li>`;
    }
    html += "</ol>";
    return html;
}

function renderCategoryHtml(categories) {
    if (!categories || Object.keys(categories).length === 0) {
        return "<p>No category breakdown available.</p>";
    }
    let html = "<ul>";
    for (const [name, value] of Object.entries(categories)) {
        html += `<li>${escapeHtml(name)}: ${escapeHtml(formatCurrency(value))}</li>`;
    }
    html += "</ul>";
    return html;
}

function renderForecastTableHtml(labels, sales, profit, limit) {
    if (!labels || labels.length === 0) {
        return "<p>No forecast data available.</p>";
    }

    const rowCount = Math.min(limit, labels.length);
    let html = "<table border='1' cellpadding='6' cellspacing='0'><tr><th>Date</th><th>Sales</th><th>Profit</th></tr>";
    for (let i = 0; i < rowCount; i += 1) {
        html += `<tr><td>${escapeHtml(String(labels[i]))}</td><td>${escapeHtml(
            formatCurrency(sales[i])
        )}</td><td>${escapeHtml(formatCurrency(profit[i]))}</td></tr>`;
    }
    html += "</table>";
    return html;
}

function renderDocImageHtml(imageSrc, title) {
    if (Array.isArray(imageSrc)) {
        const useContentRefs = Boolean(title);
        return imageSrc
            .map((entry, index) => {
                if (!entry?.image) {
                    return `<p><strong>${escapeHtml(entry?.title || `Chart ${index + 1}`)}:</strong> Image not available.</p>`;
                }

                const source = useContentRefs
                    ? `forecast-chart-${index + 1}.png`
                    : entry.image;
                return `
                    <div class="chart-block">
                        <p><strong>${escapeHtml(entry.title || `Chart ${index + 1}`)}</strong></p>
                        <img src="${source}" alt="${escapeHtml(entry.title || `Chart ${index + 1}`)}">
                    </div>
                `;
            })
            .join("");
    }

    if (!imageSrc) {
        return `<p><strong>${escapeHtml(title)}:</strong> Image not available.</p>`;
    }
    return `
        <div style="margin:12px 0 18px;">
            <p><strong>${escapeHtml(title)}</strong></p>
            <img src="${imageSrc}" alt="${escapeHtml(title)}" style="max-width:100%; height:auto; border:1px solid #ccc;">
        </div>
    `;
}

function downloadDocBlob(html, filename) {
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadAnalysisTemplate() {
    const headers = ["date", "sales", "expenses", "profit", "category"];
    const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Template</x:Name>
                            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
        </head>
        <body>
            <table border="1">
                <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bulk-data-analysis-template.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadWordDocWithImages(html, imageEntries, filename) {
    const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const mhtml = buildMhtmlDocument(html, imageEntries, boundary);
    const blob = new Blob([mhtml], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function buildMhtmlDocument(html, imageEntries, boundary) {
    const parts = [
        "MIME-Version: 1.0",
        `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
        "",
        `--${boundary}`,
        "Content-Type: text/html; charset=\"utf-8\"",
        "Content-Transfer-Encoding: quoted-printable",
        "Content-Location: forecast-report.html",
        "",
        encodeQuotedPrintable(html),
    ];

    (imageEntries || []).forEach((entry, index) => {
        const imagePart = getImageMimePart(entry?.image, `forecast-chart-${index + 1}.png`, boundary);
        if (imagePart) {
            parts.push(imagePart);
        }
    });

    parts.push(`--${boundary}--`, "");
    return parts.join("\r\n");
}

function getImageMimePart(dataUrl, contentLocation, boundary) {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
        return "";
    }

    const splitIndex = dataUrl.indexOf(",");
    if (splitIndex === -1) {
        return "";
    }

    const header = dataUrl.slice(0, splitIndex);
    const body = dataUrl.slice(splitIndex + 1);
    const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
    if (!mimeMatch) {
        return "";
    }

    return [
        `--${boundary}`,
        `Content-Type: ${mimeMatch[1]}`,
        "Content-Transfer-Encoding: base64",
        `Content-Location: ${contentLocation}`,
        "",
        wrapBase64(body),
    ].join("\r\n");
}

function wrapBase64(value) {
    return String(value || "").replace(/(.{76})/g, "$1\r\n");
}

function encodeQuotedPrintable(value) {
    return String(value || "")
        .replace(/=/g, "=3D")
        .replace(/[^\x20-\x3C\x3E-\x7E]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code === 10) {
                return "\r\n";
            }
            if (code === 13) {
                return "";
            }
            return `=${code.toString(16).toUpperCase().padStart(2, "0")}`;
        });
}

function formatCurrency(value) {
    const numeric = Number(value) || 0;
    return `Rs ${Math.round(numeric).toLocaleString()}`;
}

function ensureDataUrl(imageString) {
    if (!imageString) {
        return "";
    }
    if (imageString.startsWith("data:image/")) {
        return imageString;
    }
    return `data:image/png;base64,${imageString}`;
}

function formatIsoDate(value) {
    if (!value) {
        return "N/A";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleString();
}

function buildDateStamp() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${y}${m}${d}-${hh}${mm}`;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.innerText = value;
    }
}

function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = value;
    }
}

function formatRanking(items, prefix) {
    if (!items || Object.keys(items).length === 0) {
        return "No data available.";
    }

    const lines = [];
    let i = 1;
    for (const [name, value] of Object.entries(items)) {
        lines.push(`${i}. ${name}: ${prefix} ${Math.round(value).toLocaleString()}`);
        i += 1;
    }
    return lines.join("\n");
}

function renderChart(containerId, labels, values, label) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.innerHTML = "";
    if (!values || values.length === 0) {
        container.innerHTML = `<p>${label} data unavailable for this file.</p>`;
        return;
    }

    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: label,
                    data: values,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: "rgba(34,197,94,0.15)",
                    borderColor: "rgba(34,197,94,1)",
                    pointRadius: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        font: { size: 14 },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { maxTicksLimit: 15 },
                },
            },
        },
    });
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
