// ==UserScript==
// @name         Scaler CRM Power Dialer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Scaler CRM Power Dialer - sequential automatic lead calling with stale-lead protection
// @match        https://sales.crm.scaler.com/*
// @grant        GM_openInTab
// @updateURL    https://raw.githubusercontent.com/sgp-scaler/crm-power-dialer/refs/heads/main/power-dialer.js
// @downloadURL  https://raw.githubusercontent.com/sgp-scaler/crm-power-dialer/refs/heads/main/power-dialer.js
// ==/UserScript==

(function () {
    'use strict';

    console.log("⚡ POWER DIALER v16.1 LOADED");

    // =========================================================
    // STORAGE KEYS
    // =========================================================

    const ACTIVE_KEY = "powerDialerActive";
    const CONTINUE_KEY = "powerDialerContinue";
    const CALLED_KEY = "powerDialerCalled";
    const PROCESSED_KEY = "powerDialerProcessed";


    // =========================================================
    // HELPERS
    // =========================================================

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    // =========================================================
    // PAGE DETECTION
    // =========================================================

    function isLeadListPage() {
        return window.location.pathname === "/leads/manage";
    }

    function isLeadPage() {
        return /^\/leads\/[^/]+$/.test(
            window.location.pathname
        );
    }


    // =========================================================
    // GET CURRENT LEAD ID
    //
    // Example:
    // /leads/c7d4ccab-9dde-4771-8a6e-c6f8ef4d868d
    //
    // Returns:
    // c7d4ccab-9dde-4771-8a6e-c6f8ef4d868d
    // =========================================================

    function getCurrentLeadId() {

        if (!isLeadPage()) {
            return null;
        }

        const parts =
            window.location.pathname.split("/");

        return parts[parts.length - 1] || null;
    }


    // =========================================================
    // GET LEAD ID FROM LINK
    // =========================================================

    function getLeadIdFromHref(href) {

        if (!href) {
            return null;
        }

        try {

            const url =
                new URL(
                    href,
                    window.location.origin
                );

            const parts =
                url.pathname.split("/");

            return parts[parts.length - 1] || null;

        } catch (error) {

            console.log(
                "❌ Could not parse lead URL:",
                href
            );

            return null;
        }
    }


    // =========================================================
    // BUTTON FINDER
    // =========================================================

    function getButtonByText(text) {

        const buttons = [
            ...document.querySelectorAll("button")
        ];

        return buttons.find(button => {

            return button.innerText
                ?.trim()
                .toLowerCase() ===
                text.toLowerCase();
        });
    }


    // =========================================================
    // WAIT FOR BUTTON
    // =========================================================

    async function waitForButton(
        text,
        timeout = 15000
    ) {

        const start = Date.now();

        while (
            Date.now() - start < timeout
        ) {

            const button =
                getButtonByText(text);

            if (button) {
                return button;
            }

            await sleep(300);
        }

        console.log(
            `❌ Button not found: ${text}`
        );

        return null;
    }


    // =========================================================
    // GET LEADS FROM TABLE
    //
    // VERIFIED CRM DOM:
    //
    // tr.ant-table-row.ant-table-row-level-0
    //
    // Lead:
    // a[href^="/leads/"]
    // =========================================================

    function getLeadLinks() {

        const rows = [
            ...document.querySelectorAll(
                "tr.ant-table-row.ant-table-row-level-0"
            )
        ];

        const links = [];

        rows.forEach(row => {

            const link =
                row.querySelector(
                    'a[href^="/leads/"]'
                );

            if (link) {
                links.push(link);
            }
        });

        return links;
    }


    // =========================================================
    // WAIT FOR LEADS
    // =========================================================

    async function waitForLeads(
        timeout = 20000
    ) {

        const start = Date.now();

        while (
            Date.now() - start < timeout
        ) {

            const leads =
                getLeadLinks();

            if (leads.length > 0) {
                return leads;
            }

            await sleep(500);
        }

        console.log(
            "❌ No leads found"
        );

        return [];
    }


    // =========================================================
    // PROCESSED LEAD STORAGE
    //
    // Stored as:
    //
    // [
    //   "uuid-1",
    //   "uuid-2"
    // ]
    //
    // These are only used during the current
    // Power Dialer session.
    // =========================================================

    function getProcessedLeads() {

        try {

            const stored =
                localStorage.getItem(
                    PROCESSED_KEY
                );

            if (!stored) {
                return [];
            }

            const parsed =
                JSON.parse(stored);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.log(
                "⚠️ Could not read processed leads"
            );

            return [];
        }
    }


    function saveProcessedLeads(leads) {

        localStorage.setItem(
            PROCESSED_KEY,
            JSON.stringify(leads)
        );
    }


    function markLeadProcessed(leadId) {

        if (!leadId) {
            return;
        }

        const processed =
            getProcessedLeads();

        if (
            !processed.includes(leadId)
        ) {

            processed.push(leadId);

            saveProcessedLeads(
                processed
            );
        }

        console.log(
            "🧠 MARKED LEAD AS PROCESSED:",
            leadId
        );

        console.log(
            "🧠 PROCESSED LEADS:",
            processed
        );
    }


    function isLeadProcessed(leadId) {

        if (!leadId) {
            return false;
        }

        return getProcessedLeads()
            .includes(leadId);
    }


    // =========================================================
    // CLEAR SESSION
    //
    // Called when START is pressed.
    // =========================================================

    function clearPowerDialerSession() {

        localStorage.removeItem(
            PROCESSED_KEY
        );

        localStorage.removeItem(
            CONTINUE_KEY
        );

        console.log(
            "🧹 POWER DIALER SESSION CLEARED"
        );
    }


    // =========================================================
    // REMOVE BUTTONS
    // =========================================================

    function removeOldButtons() {

        [
            "power-dialer-start",
            "power-dialer-next"
        ].forEach(id => {

            const element =
                document.getElementById(id);

            if (element) {
                element.remove();
            }
        });
    }


    // =========================================================
    // CREATE BUTTON
    // =========================================================

    function createButton(
        id,
        text,
        background,
        top,
        onClick
    ) {

        const existing =
            document.getElementById(id);

        if (existing) {
            return existing;
        }

        const button =
            document.createElement("button");

        button.id = id;
        button.innerText = text;

        Object.assign(button.style, {

            position: "fixed",

            top: `${top}px`,

            left: "20px",

            zIndex: "999999",

            width: "230px",

            height: "48px",

            padding: "0 18px",

            border: "none",

            borderRadius: "8px",

            background: background,

            color: "#ffffff",

            fontSize: "14px",

            fontWeight: "700",

            cursor: "pointer",

            pointerEvents: "auto",

            boxShadow:
                "0 4px 12px rgba(0,0,0,0.25)",

            textAlign: "center",

            opacity: "1",

            display: "block"
        });

        button.addEventListener(
            "click",
            onClick
        );

        document.body.appendChild(
            button
        );

        return button;
    }


    // =========================================================
    // CREATE POWER DIALER URL
    // =========================================================

    function createPowerDialerUrl(href) {

        const url =
            new URL(
                href,
                window.location.origin
            );

        const token =
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2);

        url.searchParams.set(
            "pd",
            token
        );

        return url.href;
    }


    // =========================================================
    // OPEN LEAD
    // =========================================================

    function openLead(href) {

        const leadUrl =
            createPowerDialerUrl(href);

        console.log(
            "⚡ OPENING LEAD:",
            leadUrl
        );

        GM_openInTab(
            leadUrl,
            {
                active: true,
                insert: true,
                setParent: true
            }
        );
    }


    // =========================================================
    // FIND FIRST UNPROCESSED LEAD
    //
    // THIS IS THE MAIN SAFETY MECHANISM.
    //
    // If CRM is slow and the previous lead is
    // still visible, we skip it.
    // =========================================================

    function findNextUnprocessedLead(leads) {

        const processed =
            getProcessedLeads();

        console.log(
            "🧠 PROCESSED IDS:",
            processed
        );

        for (
            let i = 0;
            i < leads.length;
            i++
        ) {

            const link =
                leads[i];

            const href =
                link.getAttribute(
                    "href"
                );

            const leadId =
                getLeadIdFromHref(
                    href
                );

            if (!leadId) {
                continue;
            }

            // -------------------------------------------------
            // SKIP PREVIOUSLY PROCESSED LEAD
            // -------------------------------------------------

            if (
                processed.includes(
                    leadId
                )
            ) {

                console.log(
                    "⏭️ SKIPPING ALREADY PROCESSED LEAD:",
                    leadId
                );

                continue;
            }

            // -------------------------------------------------
            // FOUND FRESH LEAD
            // -------------------------------------------------

            console.log(
                "✅ FOUND NEXT FRESH LEAD:",
                leadId
            );

            return link;
        }

        return null;
    }


    // =========================================================
    // START POWER DIALER
    // =========================================================

    async function startPowerDialer() {

        console.log(
            "⚡ START POWER DIALER CLICKED"
        );

        if (!isLeadListPage()) {
            return;
        }

        // New session

        clearPowerDialerSession();

        localStorage.setItem(
            ACTIVE_KEY,
            "true"
        );

        const button =
            document.getElementById(
                "power-dialer-start"
            );

        if (button) {

            button.innerText =
                "⏳ OPENING LEAD...";

            button.style.cursor =
                "wait";

            button.disabled =
                true;
        }

        const leads =
            await waitForLeads();

        if (leads.length === 0) {

            localStorage.removeItem(
                ACTIVE_KEY
            );

            alert(
                "Could not find any leads."
            );

            if (button) {

                button.innerText =
                    "⚡ START POWER DIALER";

                button.style.cursor =
                    "pointer";

                button.disabled =
                    false;
            }

            return;
        }

        // -----------------------------------------------------
        // FIND FIRST UNPROCESSED
        // -----------------------------------------------------

        const firstLead =
            findNextUnprocessedLead(
                leads
            );

        if (!firstLead) {

            localStorage.removeItem(
                ACTIVE_KEY
            );

            alert(
                "No unprocessed leads found."
            );

            return;
        }

        const href =
            firstLead.getAttribute(
                "href"
            );

        const leadId =
            getLeadIdFromHref(
                href
            );

        console.log(
            "⚡ STARTING WITH LEAD:",
            leadId
        );

        openLead(href);

        if (button) {

            button.innerText =
                "⚡ START POWER DIALER";

            button.style.cursor =
                "pointer";

            button.disabled =
                false;
        }
    }


    // =========================================================
    // NEXT LEAD
    //
    // IMPORTANT:
    //
    // BEFORE CLOSING THE LEAD TAB:
    // MARK CURRENT LEAD AS PROCESSED.
    //
    // This protects against slow CRM updates.
    // =========================================================

    function nextLead() {

        console.log(
            "➡️ NEXT LEAD CLICKED"
        );

        if (!isLeadPage()) {

            alert(
                "NEXT LEAD is used from inside an active lead."
            );

            return;
        }

        const active =
            localStorage.getItem(
                ACTIVE_KEY
            );

        if (active !== "true") {

            alert(
                "Start the Power Dialer from the lead list first."
            );

            return;
        }

        // -----------------------------------------------------
        // GET CURRENT LEAD
        // -----------------------------------------------------

        const currentLeadId =
            getCurrentLeadId();

        console.log(
            "📌 CURRENT LEAD:",
            currentLeadId
        );

        // -----------------------------------------------------
        // MARK IT PROCESSED
        // -----------------------------------------------------

        markLeadProcessed(
            currentLeadId
        );

        // -----------------------------------------------------
        // SIGNAL MAIN TAB
        // -----------------------------------------------------

        console.log(
            "📡 SENDING CONTINUATION SIGNAL..."
        );

        localStorage.setItem(
            CONTINUE_KEY,
            Date.now().toString()
        );

        // -----------------------------------------------------
        // CLOSE LEAD TAB
        // -----------------------------------------------------

        setTimeout(() => {

            console.log(
                "❌ CLOSING CURRENT LEAD TAB..."
            );

            window.close();

        }, 1000);
    }


    // =========================================================
    // MAIN TAB STORAGE LISTENER
    //
    // NEXT CLICKED IN LEAD TAB
    // ↓
    // THIS FIRES IN MANAGE LEADS TAB
    // ↓
    // ACTUAL PAGE RELOAD
    // =========================================================

    window.addEventListener(
        "storage",
        function (event) {

            if (
                event.key !== CONTINUE_KEY
            ) {
                return;
            }

            if (!isLeadListPage()) {
                return;
            }

            const active =
                localStorage.getItem(
                    ACTIVE_KEY
                );

            if (active !== "true") {
                return;
            }

            console.log(
                "⚡ MAIN TAB RECEIVED NEXT SIGNAL"
            );

            // -------------------------------------------------
            // SET FLAG BEFORE RELOAD
            // -------------------------------------------------

            localStorage.setItem(
                CONTINUE_KEY,
                "REFRESHING"
            );

            console.log(
                "🔄 RELOADING MANAGE LEADS..."
            );

            // -------------------------------------------------
            // ACTUAL BROWSER RELOAD
            // -------------------------------------------------

            window.location.reload();
        }
    );


    // =========================================================
    // CONTINUE AFTER RELOAD
    //
    // Page has now reloaded.
    //
    // Wait a SOLID 4 seconds.
    //
    // Then find the first UNPROCESSED lead.
    // =========================================================

    async function continuePowerDialer() {

        console.log(
            "⚡ CONTINUING POWER DIALER AFTER RELOAD"
        );

        // Clear continuation flag

        localStorage.removeItem(
            CONTINUE_KEY
        );

        // -----------------------------------------------------
        // SOLID 4 SECOND WAIT
        // -----------------------------------------------------

        console.log(
            "⏳ WAITING 4 SECONDS FOR CRM..."
        );

        await sleep(4000);

        console.log(
            "✅ 4 SECOND WAIT COMPLETE"
        );

        // -----------------------------------------------------
        // GET CURRENT TABLE
        // -----------------------------------------------------

        const leads =
            await waitForLeads();

        if (leads.length === 0) {

            console.log(
                "🏁 NO LEADS FOUND"
            );

            localStorage.removeItem(
                ACTIVE_KEY
            );

            alert(
                "⚡ Power Dialer finished — no more leads."
            );

            return;
        }

        // -----------------------------------------------------
        // FIND FIRST UNPROCESSED LEAD
        // -----------------------------------------------------

        const nextLeadElement =
            findNextUnprocessedLead(
                leads
            );

        // -----------------------------------------------------
        // ALL VISIBLE LEADS MAY BE STALE
        // -----------------------------------------------------

        if (!nextLeadElement) {

            console.log(
                "⚠️ ALL CURRENTLY VISIBLE LEADS WERE ALREADY PROCESSED"
            );

            console.log(
                "⏳ Waiting another 4 seconds for CRM..."
            );

            await sleep(4000);

            const refreshedLeads =
                getLeadLinks();

            const retryLead =
                findNextUnprocessedLead(
                    refreshedLeads
                );

            if (!retryLead) {

                console.log(
                    "🏁 NO UNPROCESSED LEADS AVAILABLE"
                );

                localStorage.removeItem(
                    ACTIVE_KEY
                );

                alert(
                    "⚡ Power Dialer finished — no more unprocessed leads."
                );

                return;
            }

            const retryHref =
                retryLead.getAttribute(
                    "href"
                );

            console.log(
                "➡️ OPENING RETRY LEAD:",
                retryHref
            );

            openLead(
                retryHref
            );

            return;
        }

        // -----------------------------------------------------
        // OPEN NEXT LEAD
        // -----------------------------------------------------

        const href =
            nextLeadElement.getAttribute(
                "href"
            );

        const nextLeadId =
            getLeadIdFromHref(
                href
            );

        console.log(
            "➡️ NEXT LEAD:",
            nextLeadId
        );

        openLead(href);
    }


    // =========================================================
    // MAIN LIST PAGE
    // =========================================================

    function initMainPage() {

        console.log(
            "⚡ POWER DIALER: /leads/manage"
        );

        removeOldButtons();

        // -----------------------------------------------------
        // START
        // -----------------------------------------------------

        createButton(
            "power-dialer-start",
            "⚡ START POWER DIALER",
            "#1677ff",
            20,
            startPowerDialer
        );

        // -----------------------------------------------------
        // NEXT
        // -----------------------------------------------------

        createButton(
            "power-dialer-next",
            "➡️ NEXT LEAD",
            "#722ed1",
            82,
            nextLead
        );

        // -----------------------------------------------------
        // CHECK FOR POST-RELOAD CONTINUATION
        // -----------------------------------------------------

        const continueSignal =
            localStorage.getItem(
                CONTINUE_KEY
            );

        if (
            continueSignal ===
            "REFRESHING"
        ) {

            console.log(
                "⚡ POST-RELOAD CONTINUATION DETECTED"
            );

            continuePowerDialer();
        }
    }


    // =========================================================
    // LEAD PAGE
    // =========================================================

    function initLeadPage() {

        console.log(
            "⚡ POWER DIALER: LEAD PAGE"
        );

        removeOldButtons();

        // -----------------------------------------------------
        // NEXT BUTTON
        // -----------------------------------------------------

        createButton(
            "power-dialer-next",
            "➡️ NEXT LEAD",
            "#722ed1",
            20,
            nextLead
        );

        // -----------------------------------------------------
        // POWER DIALER TOKEN
        // -----------------------------------------------------

        const params =
            new URLSearchParams(
                window.location.search
            );

        const token =
            params.get("pd");

        // Manually opened lead

        if (!token) {

            console.log(
                "👤 MANUAL LEAD"
            );

            console.log(
                "🚫 AUTO CALL DISABLED"
            );

            return;
        }

        // -----------------------------------------------------
        // PREVENT DUPLICATE CALL
        // -----------------------------------------------------

        const alreadyCalled =
            sessionStorage.getItem(
                CALLED_KEY
            );

        if (
            alreadyCalled === token
        ) {

            console.log(
                "📞 THIS POWER DIALER TOKEN ALREADY CALLED"
            );

            return;
        }

        sessionStorage.setItem(
            CALLED_KEY,
            token
        );

        console.log(
            "⚡ POWER DIALER LEAD DETECTED"
        );

        console.log(
            "📞 STARTING AUTO CALL..."
        );

        autoCallLead();
    }


    // =========================================================
    // AUTO CALL
    // =========================================================

    async function autoCallLead() {

        console.log(
            "📞 AUTO CALL STARTING..."
        );

        // Give CRM time to render

        await sleep(1500);

        // -----------------------------------------------------
        // CALL LEAD
        // -----------------------------------------------------

        console.log(
            "🔎 LOOKING FOR CALL LEAD..."
        );

        const callLead =
            await waitForButton(
                "Call Lead",
                15000
            );

        if (!callLead) {

            console.log(
                "❌ CALL LEAD NOT FOUND"
            );

            return;
        }

        console.log(
            "📞 CLICKING CALL LEAD"
        );

        callLead.click();

        // -----------------------------------------------------
        // CONFIRM CALL
        // -----------------------------------------------------

        await sleep(700);

        console.log(
            "🔎 LOOKING FOR CALL..."
        );

        const call =
            await waitForButton(
                "Call",
                10000
            );

        if (!call) {

            console.log(
                "❌ CALL CONFIRMATION NOT FOUND"
            );

            return;
        }

        console.log(
            "📞 CLICKING CALL"
        );

        call.click();

        // -----------------------------------------------------
        // EXOTEL
        // -----------------------------------------------------

        console.log(
            "⏳ WAITING FOR EXOTEL..."
        );

        await sleep(3000);

        const ok =
            await waitForButton(
                "OK",
                10000
            );

        if (ok) {

            console.log(
                "✅ CLICKING OK"
            );

            ok.click();

        } else {

            console.log(
                "⚠️ OK BUTTON NOT FOUND"
            );
        }

        console.log(
            "✅ CALL INITIATED"
        );
    }


    // =========================================================
    // INIT
    // =========================================================

    function init() {

        if (!document.body) {
            return;
        }

        if (isLeadListPage()) {

            initMainPage();

            return;
        }

        if (isLeadPage()) {

            initLeadPage();

            return;
        }

        console.log(
            "⚪ POWER DIALER: UNSUPPORTED PAGE",
            window.location.pathname
        );
    }


    // =========================================================
    // WAIT FOR BODY
    // =========================================================

    const initInterval =
        setInterval(() => {

            if (document.body) {

                clearInterval(
                    initInterval
                );

                init();
            }

        }, 500);

})();
