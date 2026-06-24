/* CivicAI Frontend Application Controller */

const API_BASE = "http://127.0.0.1:8000";

// Global Variables
let currentUserId = 1; // Assigned from seeded test user (Arjun Sharma)
let complaints = [];
let maps = {
    miniMap: null,
    mobileFullMap: null,
    dashboardMap: null
};
let markers = {
    mobile: [],
    dashboard: []
};
let charts = {
    categories: null,
    departments: null,
    funnel: null
};
let currentMapMarker = null; // Marker on the report mini-map
let selectedSampleImg = null;

// Speech-to-Text Transcripts Mock (Whisper)
const sampleTranscripts = [
    "Severe pothole near Sector 14, Main Road Near Temple causing major vehicle traffic slowdowns and unsafe conditions.",
    "Huge pile of garbage accumulation near Market Square Parking Area, stinking very badly and blocking pathway.",
    "Broken streetlight repair needed in Vasant Kunj, Block C Lane 4. Entire lane is completely dark and unsafe at night.",
    "Water leakage from pipe near Metro Station gate number 2. Thousand liters of drinking water wasted."
];

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initMaps();
    initFormHandlers();
    initChatbot();
    
    // Initial Load
    fetchComplaints();
    fetchAnalytics();
    
    // Refresh button
    document.getElementById("btn-refresh-dashboard").addEventListener("click", () => {
        fetchComplaints();
        fetchAnalytics();
    });
});

// ================= NAVIGATION SYSTEM =================
function initNavigation() {
    const navItems = document.querySelectorAll(".phone-footer-nav .nav-item");
    const screens = document.querySelectorAll(".mobile-screen");
    
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetScreen = item.getAttribute("data-target");
            
            navItems.forEach(nav => nav.classList.remove("active"));
            screens.forEach(scr => scr.classList.remove("active"));
            
            item.classList.add("active");
            document.getElementById(targetScreen).classList.add("active");
            
            // Map tab adjustment (Leaflet requires invalidating size when unhidden)
            if (targetScreen === "screen-map" && maps.mobileFullMap) {
                setTimeout(() => {
                    maps.mobileFullMap.invalidateSize();
                }, 100);
            }
        });
    });

    // Custom buttons navigation
    document.getElementById("btn-report-banner").addEventListener("click", () => {
        navigateToScreen("screen-report");
    });
    document.getElementById("btn-mobile-map").addEventListener("click", () => {
        navigateToScreen("screen-map");
    });
    document.getElementById("btn-mobile-my-complaints").addEventListener("click", () => {
        navigateToScreen("screen-profile");
    });
    document.getElementById("btn-mobile-view-all").addEventListener("click", (e) => {
        e.preventDefault();
        navigateToScreen("screen-profile");
    });
    document.getElementById("btn-ask-assistant").addEventListener("click", () => {
        navigateToScreen("screen-chat");
    });
    document.getElementById("btn-mobile-chat").addEventListener("click", () => {
        navigateToScreen("screen-chat");
    });
    
    // Back buttons
    document.getElementById("btn-report-back").addEventListener("click", () => navigateToScreen("screen-home"));
    document.getElementById("btn-map-back").addEventListener("click", () => navigateToScreen("screen-home"));
    document.getElementById("btn-chat-back").addEventListener("click", () => navigateToScreen("screen-home"));
    document.getElementById("btn-notifications-back").addEventListener("click", () => navigateToScreen("screen-home"));
    document.getElementById("btn-profile-back").addEventListener("click", () => navigateToScreen("screen-home"));
}

function navigateToScreen(screenId) {
    const screens = document.querySelectorAll(".mobile-screen");
    const navItems = document.querySelectorAll(".phone-footer-nav .nav-item");
    
    screens.forEach(scr => scr.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");
    
    navItems.forEach(nav => {
        nav.classList.remove("active");
        if (nav.getAttribute("data-target") === screenId) {
            nav.classList.add("active");
        }
    });
    
    if (screenId === "screen-map" && maps.mobileFullMap) {
        setTimeout(() => {
            maps.mobileFullMap.invalidateSize();
        }, 100);
    }
}

// ================= MAPS INITIALIZATION =================
function initMaps() {
    const centerLatLng = [28.4595, 77.0266]; // Default coordinates (Sector 14 Gurugram)
    
    // 1. Mini picking map inside report form
    maps.miniMap = L.map("mobile-mini-map", { zoomControl: false }).setView(centerLatLng, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap'
    }).addTo(maps.miniMap);
    
    currentMapMarker = L.marker(centerLatLng, { draggable: true }).addTo(maps.miniMap);
    
    currentMapMarker.on("dragend", (e) => {
        const position = currentMapMarker.getLatLng();
        updateFormLatLng(position.lat, position.lng);
    });
    
    maps.miniMap.on("click", (e) => {
        currentMapMarker.setLatLng(e.latlng);
        updateFormLatLng(e.latlng.lat, e.latlng.lng);
    });

    // 2. Full screen map inside phone tabs
    maps.mobileFullMap = L.map("mobile-full-map", { zoomControl: true }).setView(centerLatLng, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(maps.mobileFullMap);

    // 3. GIS Command map on Municipal Dashboard
    maps.dashboardMap = L.map("dashboard-gis-map", { zoomControl: true }).setView(centerLatLng, 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
        attribution: '&copy; CARTO'
    }).addTo(maps.dashboardMap);
}

function updateFormLatLng(lat, lng) {
    document.getElementById("val-lat").textContent = lat.toFixed(5);
    document.getElementById("val-lng").textContent = lng.toFixed(5);
}

// ================= DATA SYNCING =================

async function fetchComplaints() {
    try {
        const response = await fetch(`${API_BASE}/complaints`);
        if (!response.ok) throw new Error("API Failure");
        complaints = await response.json();
        
        renderComplaintsList();
        renderComplaintsTable();
        plotMapMarkers();
        renderNotifications();
    } catch (err) {
        console.error("Error fetching complaints:", err);
    }
}

function renderNotifications() {
    const list = document.getElementById("mobile-notifications-list");
    if (!list) return;
    list.innerHTML = "";
    
    // Add default system welcome notification
    const welcome = document.createElement("div");
    welcome.className = "notification-item";
    welcome.innerHTML = `
        <div class="notif-icon info-icon"><i class="fa-solid fa-circle-info"></i></div>
        <div class="notif-content">
            <p class="notif-text">Welcome to CivicAI! Start reporting local issues to earn impact points.</p>
            <span class="notif-time">Just now</span>
        </div>
    `;
    list.appendChild(welcome);
    
    // Create notifications based on actual complaints
    const recentComplaints = complaints.slice(0, 3);
    recentComplaints.forEach(c => {
        const item = document.createElement("div");
        item.className = "notification-item";
        
        let iconClass = "info-icon";
        let iconHtml = '<i class="fa-solid fa-circle-info"></i>';
        let text = "";
        
        if (c.status === "Resolved") {
            iconClass = "success-icon";
            iconHtml = '<i class="fa-solid fa-circle-check"></i>';
            text = `Ticket #CIV-${c.id} (${c.issue_type}) has been resolved! Department notes: "Issue resolved successfully."`;
        } else if (c.status === "In Progress") {
            iconClass = "alert-icon";
            iconHtml = '<i class="fa-solid fa-person-digging"></i>';
            text = `Work started on Ticket #CIV-${c.id} (${c.issue_type}) near Sector 14.`;
        } else {
            iconClass = "info-icon";
            iconHtml = '<i class="fa-solid fa-satellite-dish"></i>';
            text = `Ticket #CIV-${c.id} (${c.issue_type}) reported and routed to ${c.department || 'General'} Department.`;
        }
        
        item.innerHTML = `
            <div class="notif-icon ${iconClass}">${iconHtml}</div>
            <div class="notif-content">
                <p class="notif-text">${text}</p>
                <span class="notif-time">Recent</span>
            </div>
        `;
        list.appendChild(item);
    });
}

function renderComplaintsList() {
    // 1. Mobile Home Screen list (limit to 3)
    const homeList = document.getElementById("mobile-recent-list");
    homeList.innerHTML = "";
    
    const recent = complaints.slice(0, 3);
    if (recent.length === 0) {
        homeList.innerHTML = '<div class="activity-item"><p style="font-size:0.75rem; color:#64748b;">No recent activities reported.</p></div>';
        return;
    }
    
    recent.forEach(c => {
        const cardClass = getDeptClass(c.department);
        const icon = getIssueIcon(c.issue_type);
        const statusClass = c.status.toLowerCase().replace(" ", "_");
        
        const item = document.createElement("div");
        item.className = "activity-item";
        item.innerHTML = `
            <div class="activity-icon-box ${cardClass}">
                <i class="${icon}"></i>
            </div>
            <div class="activity-details">
                <h5>${c.issue_type}</h5>
                <p>${c.description}</p>
            </div>
            <span class="status-badge-small ${statusClass}">${c.status}</span>
        `;
        homeList.appendChild(item);
    });

    // 2. Mobile My Complaints Screen list (all)
    const myList = document.getElementById("mobile-my-complaints-list");
    myList.innerHTML = "";
    
    if (complaints.length === 0) {
        myList.innerHTML = '<p style="font-size:0.8rem; color:#64748b; text-align:center; margin-top:20px;">You haven\'t submitted any complaints yet.</p>';
        return;
    }
    
    complaints.forEach(c => {
        const cardClass = getDeptClass(c.department);
        const icon = getIssueIcon(c.issue_type);
        const statusClass = c.status.toLowerCase().replace(" ", "_");
        
        const item = document.createElement("div");
        item.className = "activity-item";
        item.innerHTML = `
            <div class="activity-icon-box ${cardClass}">
                <i class="${icon}"></i>
            </div>
            <div class="activity-details">
                <h5>Ticket #${c.id}: ${c.issue_type}</h5>
                <p>${c.description}</p>
                <div style="font-size:0.6rem; color:#94a3b8; margin-top:4px;">
                    Severity: <strong>${c.severity}</strong> • Upvotes: <strong>${c.upvotes}</strong>
                </div>
            </div>
            <span class="status-badge-small ${statusClass}">${c.status}</span>
        `;
        myList.appendChild(item);
    });
}

function renderComplaintsTable() {
    const tableBody = document.getElementById("table-complaints-body");
    tableBody.innerHTML = "";
    
    const searchVal = document.getElementById("table-search").value.toLowerCase();
    const typeVal = document.getElementById("filter-type").value;
    const statusVal = document.getElementById("filter-status").value;
    
    const filtered = complaints.filter(c => {
        const matchesSearch = c.description.toLowerCase().includes(searchVal) || c.id.toString().includes(searchVal);
        const matchesType = !typeVal || c.issue_type === typeVal;
        const matchesStatus = !statusVal || c.status === statusVal;
        return matchesSearch && matchesType && matchesStatus;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b;">No complaints matching filters found.</td></tr>';
        return;
    }

    filtered.forEach(c => {
        const statusClass = c.status.toLowerCase().replace(" ", "_");
        const severityClass = c.severity.toLowerCase();
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>
                <span class="ticket-id-tag">#CIV-${c.id}</span>
                ${c.is_duplicate ? '<br><span style="font-size:0.6rem; background:rgba(239,68,68,0.15); color:#f87171; padding:1px 4px; border-radius:4px;">DUPLICATE</span>' : ''}
            </td>
            <td>
                <div style="font-weight:600; color:#fff;">${c.issue_type}</div>
                <div class="desc-cell" title="${c.description}">${c.description}</div>
            </td>
            <td>
                <div class="location-cell">${c.description.split("near").slice(1).join("").trim() || "Local Area"}</div>
                <div class="location-coords">${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}</div>
            </td>
            <td>
                <span class="severity-pill ${severityClass}">${c.severity}</span>
                <div style="font-size:0.6rem; color:#64748b; margin-top:2px;">Score: ${c.severity_score}</div>
            </td>
            <td class="cell-dept">${c.department || 'Unassigned'}</td>
            <td>
                <span class="status-pill ${statusClass}">${c.status}</span>
            </td>
            <td class="cell-upvotes"><i class="fa-solid fa-heart" style="color:#ef4444; margin-right:4px;"></i>${c.upvotes}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-table-action audit-btn" onclick="openTicketDetailModal(${c.id})">
                        <i class="fa-solid fa-folder-open"></i> Audit
                    </button>
                    <button class="btn-table-action" onclick="upvoteTicket(${c.id})">
                        <i class="fa-solid fa-thumbs-up"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function plotMapMarkers() {
    // Clear old markers
    markers.mobile.forEach(m => maps.mobileFullMap.removeLayer(m));
    markers.dashboard.forEach(m => maps.dashboardMap.removeLayer(m));
    markers.mobile = [];
    markers.dashboard = [];
    
    complaints.forEach(c => {
        const color = getDeptColor(c.department);
        
        // Leaflet custom div icon (color pin)
        const customIcon = L.divIcon({
            html: `<div style="background-color:${color}; width:12px; height:12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 6px ${color};"></div>`,
            className: "custom-map-pin"
        });
        
        // 1. Mobile full map
        const mMobile = L.marker([c.latitude, c.longitude], { icon: customIcon })
            .bindPopup(`<strong>${c.issue_type}</strong><br>${c.description}<br>Status: <strong>${c.status}</strong>`)
            .addTo(maps.mobileFullMap);
        markers.mobile.push(mMobile);
        
        // 2. Dashboard map
        const mDashboard = L.marker([c.latitude, c.longitude], { icon: customIcon })
            .bindPopup(`
                <div style="color:#1e293b; font-family:sans-serif; width:180px;">
                    <strong style="color:#1e3a8a;">#CIV-${c.id}: ${c.issue_type}</strong><br>
                    <span style="font-size:0.75rem;">${c.description}</span><br>
                    <div style="margin-top:6px; display:flex; justify-content:space-between; font-size:0.7rem;">
                        <span>Status: <strong>${c.status}</strong></span>
                        <span>Dept: <strong>${c.department}</strong></span>
                    </div>
                    <button style="width:100%; margin-top:8px; background:#2563eb; color:#fff; border:none; padding:4px; border-radius:4px; font-size:0.7rem; cursor:pointer;" onclick="openTicketDetailModal(${c.id})">Audit Ticket</button>
                </div>
            `)
            .addTo(maps.dashboardMap);
        markers.dashboard.push(mDashboard);
    });
}

async function fetchAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/analytics`);
        if (!response.ok) throw new Error("API Failure");
        const data = await response.json();
        
        // Update Ribbon Stats
        document.getElementById("stat-total-complaints").textContent = data.total_complaints;
        document.getElementById("stat-active-complaints").textContent = data.active_complaints;
        document.getElementById("stat-resolved-complaints").textContent = data.resolved_complaints;
        document.getElementById("stat-avg-resolution").textContent = `${data.avg_resolution_hours} hrs`;
        document.getElementById("stat-sla-rate").textContent = `${data.sla_compliance_rate}%`;
        
        // Mobile stats update
        document.getElementById("mobile-stat-total").textContent = data.total_complaints;
        document.getElementById("mobile-stat-active").textContent = data.active_complaints;
        document.getElementById("mobile-stat-resolved").textContent = data.resolved_complaints;
        
        // Calculate community impact score: resolved * 15 + active * 5 + totalUpvotes * 3
        const totalUpvotes = complaints.reduce((sum, c) => sum + (c.upvotes || 0), 0);
        const impactScore = (data.resolved_complaints * 15) + (data.active_complaints * 5) + (totalUpvotes * 3);
        document.getElementById("mobile-stat-impact").textContent = impactScore;
        
        renderAnalyticsCharts(data);
    } catch (err) {
        console.error("Error fetching analytics:", err);
    }
}

// ================= CHARTS GENERATION (CHART.JS) =================
function renderAnalyticsCharts(data) {
    const chartConfig = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#94a3b8', font: { size: 9 } }
            }
        }
    };

    // 1. Categories pie chart
    const catKeys = Object.keys(data.by_type);
    const catVals = Object.values(data.by_type);
    
    if (charts.categories) charts.categories.destroy();
    charts.categories = new Chart(document.getElementById("chart-categories"), {
        type: 'pie',
        data: {
            labels: catKeys,
            datasets: [{
                data: catVals,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#0284c7', '#8b5cf6']
            }]
        },
        options: chartConfig
    });

    // 2. Department workload bar chart
    const deptKeys = Object.keys(data.by_department);
    const deptVals = Object.values(data.by_department);
    
    if (charts.departments) charts.departments.destroy();
    charts.departments = new Chart(document.getElementById("chart-departments"), {
        type: 'bar',
        data: {
            labels: deptKeys,
            datasets: [{
                label: 'Tickets',
                data: deptVals,
                backgroundColor: '#3b82f6'
            }]
        },
        options: {
            ...chartConfig,
            scales: {
                x: { ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8', stepSize: 1 } }
            }
        }
    });

    // 3. Status funnel doughnut chart
    const statKeys = Object.keys(data.by_status);
    const statVals = Object.values(data.by_status);
    
    if (charts.funnel) charts.funnel.destroy();
    charts.funnel = new Chart(document.getElementById("chart-funnel"), {
        type: 'doughnut',
        data: {
            labels: statKeys,
            datasets: [{
                data: statVals,
                backgroundColor: ['#64748b', '#2563eb', '#f59e0b', '#10b981']
            }]
        },
        options: chartConfig
    });
}

// ================= COMPLAINT SUBMISSION FLOW =================
function initFormHandlers() {
    const fileInput = document.getElementById("mobile-file-input");
    const dropzone = document.getElementById("image-dropzone");
    const preview = document.getElementById("upload-preview");
    const placeholder = document.getElementById("upload-placeholder");
    
    dropzone.addEventListener("click", (e) => {
        e.preventDefault();
        fileInput.click();
    });
    
    fileInput.addEventListener("change", (e) => {
        if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                preview.src = event.target.result;
                preview.style.display = "block";
                placeholder.style.display = "none";
            };
            reader.readAsDataURL(fileInput.files[0]);
            selectedSampleImg = null;
            
            // De-select sample buttons
            document.querySelectorAll(".btn-sample-img").forEach(b => b.classList.remove("selected"));
        }
    });

    // Geolocation API Action
    const btnLocate = document.getElementById("btn-fetch-location");
    if (btnLocate) {
        btnLocate.addEventListener("click", () => {
            const locateIcon = btnLocate.querySelector("i");
            locateIcon.className = "fa-solid fa-spinner fa-spin";
            
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        
                        // Update form values
                        updateFormLatLng(lat, lng);
                        
                        // Move marker and pan map
                        if (currentMapMarker) {
                            currentMapMarker.setLatLng([lat, lng]);
                        }
                        if (maps.miniMap) {
                            maps.miniMap.setView([lat, lng], 15);
                        }
                        
                        locateIcon.className = "fa-solid fa-location-crosshairs";
                    },
                    (error) => {
                        alert("Error fetching location: " + error.message);
                        locateIcon.className = "fa-solid fa-location-crosshairs";
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            } else {
                alert("Geolocation is not supported by this browser.");
                locateIcon.className = "fa-solid fa-location-crosshairs";
            }
        });
    }

    // Sample buttons helper
    const sampleButtons = document.querySelectorAll(".btn-sample-img");
    sampleButtons.forEach((btn, index) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            sampleButtons.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            
            selectedSampleImg = btn.getAttribute("data-img");
            
            // Mock preview picture setting
            preview.src = `https://images.unsplash.com/photo-${getMockUnsplashId(selectedSampleImg)}?auto=format&fit=crop&q=80&w=400&h=300`;
            preview.style.display = "block";
            placeholder.style.display = "none";
            
            // Fill description and trigger mic animation to pretend speech transcription
            document.getElementById("mobile-description").value = sampleTranscripts[index];
        });
    });

    // Voice recorder simulation
    const btnVoice = document.getElementById("btn-voice-recorder");
    const voiceStatus = document.getElementById("voice-status-text");
    const wave = document.getElementById("wave-visualizer");
    let isRecording = false;
    
    btnVoice.addEventListener("click", () => {
        if (!isRecording) {
            isRecording = true;
            btnVoice.classList.add("recording");
            voiceStatus.textContent = "Listening with Whisper AI...";
            wave.style.display = "flex";
            
            // Transcribe random transcript after 3.5 seconds
            setTimeout(() => {
                const randomTranscript = sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)];
                document.getElementById("mobile-description").value = randomTranscript;
                
                isRecording = false;
                btnVoice.classList.remove("recording");
                voiceStatus.textContent = "Transcribed successfully!";
                wave.style.display = "none";
            }, 3500);
        }
    });

    // Form submit
    const form = document.getElementById("mobile-report-form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Enforce photo requirement client-side
        if (!fileInput.files[0] && !selectedSampleImg) {
            alert("Please upload a photo or select a sample image before submitting.");
            return;
        }
        
        const description = document.getElementById("mobile-description").value;
        const lat = parseFloat(document.getElementById("val-lat").textContent);
        const lng = parseFloat(document.getElementById("val-lng").textContent);
        
        // Show AI steps
        const aiCard = document.getElementById("ai-analyzing-card");
        aiCard.style.display = "block";
        
        const steps = ["step-yolo", "step-bert", "step-clip", "step-xgboost"];
        steps.forEach(s => {
            const el = document.getElementById(s);
            el.className = "ai-step";
        });
        
        // Animate AI analysis steps sequentially
        for (let i = 0; i < steps.length; i++) {
            await delay(800);
            document.getElementById(steps[i]).classList.add("completed");
        }
        
        await delay(500);
        aiCard.style.display = "none";
        
        // Form Data Assembly
        const formData = new FormData();
        formData.append("description", description);
        formData.append("latitude", lat);
        formData.append("longitude", lng);
        formData.append("user_id", currentUserId);
        
        if (fileInput.files[0]) {
            formData.append("image", fileInput.files[0]);
        } else if (selectedSampleImg) {
            // Mock files when selecting quick samples
            formData.append("image", new File([""], selectedSampleImg));
        }

        try {
            const response = await fetch(`${API_BASE}/complaints`, {
                method: "POST",
                body: formData
            });
            
            if (!response.ok) throw new Error("API Failure");
            const newComplaint = await response.json();
            
            // Pop audit log inside dashboard
            addAuditLogCard(newComplaint);
            
            // Reset form
            form.reset();
            preview.style.display = "none";
            placeholder.style.display = "flex";
            selectedSampleImg = null;
            document.querySelectorAll(".btn-sample-img").forEach(b => b.classList.remove("selected"));
            
            // Load and switch to My Complaints
            fetchComplaints();
            fetchAnalytics();
            navigateToScreen("screen-list");
            
        } catch (err) {
            console.error("Submission error:", err);
            alert("Failed to report complaint. Is the FastAPI server running?");
        }
    });
}

function addAuditLogCard(c) {
    const auditContainer = document.getElementById("ai-audit-logs");
    
    // Clear empty state if present
    const emptyState = auditContainer.querySelector(".empty-audit-state");
    if (emptyState) emptyState.remove();
    
    const card = document.createElement("div");
    card.className = "audit-log-card";
    card.innerHTML = `
        <div class="log-meta-row">
            <span>Ticket #${c.id}</span>
            <span>${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="log-title-row">
            AI Pipeline Execution Logs
        </div>
        <div class="log-data-grid">
            <span>YOLOv11:<br><strong>${c.issue_type}</strong></span>
            <span>Severity:<br><strong>${c.severity} (${c.severity_score})</strong></span>
            <span>Route:<br><strong>${c.department || 'General'}</strong></span>
        </div>
        <div style="margin-top:6px; font-size:0.65rem; color:#94a3b8;">
            CLIP Duplicate Scan: <strong>${c.is_duplicate ? `Duplicate flag enabled. Linked to Master #${c.master_ticket_id}` : 'No duplicates found'}</strong>
        </div>
    `;
    auditContainer.prepend(card);
}

// ================= BOT ASSISTANT (CHAT) =================
function initChatbot() {
    const input = document.getElementById("chat-input-text");
    const sendBtn = document.getElementById("btn-send-chat");
    const container = document.getElementById("chat-messages-container");
    
    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;
        
        // Append user bubble
        appendMessageBubble(text, "user");
        input.value = "";
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, user_id: currentUserId })
            });
            if (!response.ok) throw new Error();
            const data = await response.json();
            
            // Append bot bubble after a short thinking delay
            await delay(500);
            appendMessageBubble(data.response, "bot");
            container.scrollTop = container.scrollHeight;
        } catch (err) {
            appendMessageBubble("Network connection error, chatbot is offline.", "bot");
        }
    };

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendMessage();
    });
}

function appendMessageBubble(text, sender) {
    const container = document.getElementById("chat-messages-container");
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}`;
    bubble.innerHTML = `
        <p>${text}</p>
        <span class="chat-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    container.appendChild(bubble);
}

// ================= TICKET AUDITING MODAL =================
let activeAuditTicketId = null;

async function openTicketDetailModal(ticketId) {
    activeAuditTicketId = ticketId;
    
    try {
        const response = await fetch(`${API_BASE}/complaints/${ticketId}`);
        if (!response.ok) throw new Error();
        const c = await response.json();
        
        // Update Modal elements
        document.getElementById("modal-ticket-id").textContent = `#CIV-${c.id}`;
        document.getElementById("modal-category").textContent = c.issue_type;
        document.getElementById("modal-severity-score").textContent = `${c.severity_score} / 100 (${c.severity})`;
        document.getElementById("modal-lat").textContent = c.latitude.toFixed(5);
        document.getElementById("modal-lng").textContent = c.longitude.toFixed(5);
        document.getElementById("modal-description").textContent = c.description;
        
        // Set Image & YOLO overlay
        const img = document.getElementById("modal-image");
        const yoloContainer = document.getElementById("yolo-bounding-boxes-container");
        yoloContainer.innerHTML = "";
        
        if (c.images && c.images.length > 0) {
            const imgUrl = c.images[0].image_url;
            if (imgUrl.includes("/uploads/mock_")) {
                // Seed mock images
                img.src = `https://images.unsplash.com/photo-${getMockUnsplashId(imgUrl)}?auto=format&fit=crop&q=80&w=600&h=400`;
            } else {
                img.src = `${API_BASE}${imgUrl}`;
            }
            
            // Draw simulated YOLOv11 bounding box
            const box = document.createElement("div");
            box.className = "yolo-box";
            box.style.left = "25%";
            box.style.top = "20%";
            box.style.width = "45%";
            box.style.height = "55%";
            box.innerHTML = `<span class="yolo-box-label">${c.issue_type} (96%)</span>`;
            yoloContainer.appendChild(box);
        } else {
            // Fallback placeholder image
            img.src = "https://images.unsplash.com/photo-1599740831476-b09148d88e01?auto=format&fit=crop&q=80&w=600&h=400";
        }
        
        // Populate Timeline log
        const timeline = document.getElementById("modal-timeline-list");
        timeline.innerHTML = "";
        
        c.logs.forEach((log, index) => {
            const item = document.createElement("div");
            item.className = `timeline-item ${index === c.logs.length - 1 ? 'active' : ''}`;
            item.innerHTML = `
                <div class="timeline-time">${new Date(log.timestamp).toLocaleString()}</div>
                <div class="timeline-title">${log.status} - Updated by ${log.updated_by}</div>
                <div class="timeline-notes">${log.comments || ''}</div>
            `;
            timeline.appendChild(item);
        });

        // Set Form defaults
        document.getElementById("modal-update-status").value = c.status === "Submitted" ? "Verified" : c.status;
        document.getElementById("modal-update-dept").value = c.department || "PWD";
        document.getElementById("modal-update-comments").value = "";

        // Open Modal
        document.getElementById("modal-ticket-detail").style.display = "flex";
        
    } catch (err) {
        alert("Failed to load ticket details");
    }
}

// Modal closing
document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("modal-ticket-detail").style.display = "none";
});

// Update Status Form submission
document.getElementById("modal-update-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeAuditTicketId) return;
    
    const status = document.getElementById("modal-update-status").value;
    const department = document.getElementById("modal-update-dept").value;
    const comments = document.getElementById("modal-update-comments").value;
    
    try {
        const response = await fetch(`${API_BASE}/complaints/${activeAuditTicketId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, department, comments })
        });
        
        if (!response.ok) throw new Error();
        
        // Close modal and reload data
        document.getElementById("modal-ticket-detail").style.display = "none";
        fetchComplaints();
        fetchAnalytics();
        
    } catch (err) {
        alert("Failed to update status.");
    }
});

async function upvoteTicket(ticketId) {
    try {
        const response = await fetch(`${API_BASE}/complaints/${ticketId}/upvote`, {
            method: "POST"
        });
        if (!response.ok) throw new Error();
        fetchComplaints();
        fetchAnalytics();
    } catch (err) {
        console.error("Failed to upvote:", err);
    }
}

// ================= UTILITIES & HELPERS =================

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function getDeptClass(dept) {
    if (!dept) return "pwd";
    const d = dept.toLowerCase();
    if (d.includes("sanit")) return "sanitation";
    if (d.includes("elect")) return "electrical";
    if (d.includes("water")) return "water";
    return "pwd";
}

function getDeptColor(dept) {
    if (!dept) return "#3b82f6";
    const d = dept.toLowerCase();
    if (d.includes("sanit")) return "#10b981";
    if (d.includes("elect")) return "#d97706";
    if (d.includes("water")) return "#0284c7";
    return "#3b82f6"; // PWD/Default
}

function getIssueIcon(issue) {
    switch(issue) {
        case "Pothole": return "fa-solid fa-road-barrier";
        case "Road Damage": return "fa-solid fa-road";
        case "Garbage": return "fa-solid fa-trash-can";
        case "Overflowing Dustbin": return "fa-solid fa-dumpster";
        case "Broken Streetlight": return "fa-solid fa-lightbulb";
        case "Water Leakage": return "fa-solid fa-faucet-drip";
        case "Open Manhole": return "fa-solid fa-circle-nodes";
        default: return "fa-solid fa-circle-question";
    }
}

// Helper to match seed images to beautiful unsplash IDs
function getMockUnsplashId(img) {
    if (img.includes("pothole")) return "1515162305285-0293e4767cc2"; // Road crack
    if (img.includes("light")) return "1506543731388-49787c3c33cc"; // Lamp post
    if (img.includes("garbage")) return "1611284446314-60a58ac0deb9"; // Garbage dump
    if (img.includes("leakage")) return "1585338107529-13afc5f02586"; // Pipe leak
    return "1599740831476-b09148d88e01";
}
