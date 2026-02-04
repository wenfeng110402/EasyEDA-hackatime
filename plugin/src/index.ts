// Hackatime Extension for EasyEDA Pro
// Based on easyeda-wakatime patterns, adapted for Hackatime
// Thanks to https://github.com/radeeyate/easyeda-wakatime

import * as extensionConfig from '../extension.json';

// Constants
const VERSION = extensionConfig.version;
const TITLE = 'Hackatime';
const DEFAULT_API_URL = 'https://hackatime.hackclub.com/api/hackatime/v1';
const HEARTBEAT_INTERVAL = 25000; // 25 seconds
const INACTIVITY_TIMEOUT = 30000; // 30 seconds

// Storage keys
const API_URL_KEY = 'apiURL';
const API_KEY_KEY = 'apiKey';
const LAST_EVENT_TIME_KEY = 'lastEventTime';
const PREVIOUS_SCH_COUNT_KEY = 'previousSchCount';
const PREVIOUS_PCB_COUNT_KEY = 'previousPcbCount';

const COMMON_HEADERS = {
	'Accept': 'application/json',
	'Content-Type': 'application/json',
};

interface Heartbeat {
	entity: string;
	type: string;
	category: string;
	time: number;
	project: string;
	language: string;
	is_write: boolean;
	lines?: number;
	line_additions?: number;
	line_deletions?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions (declared first to avoid use-before-define)
// ─────────────────────────────────────────────────────────────────────────────

async function checkApiCredentials(): Promise<boolean> {
	const apiKey = await eda.sys_Storage.getExtensionUserConfig(API_KEY_KEY);
	if (!apiKey) {
		eda.sys_MessageBox.showInformationMessage(
			'Please set your Hackatime API Key in Settings first.',
			TITLE,
		);
		return false;
	}
	return true;
}

async function getApiUrl(): Promise<string> {
	const url = await eda.sys_Storage.getExtensionUserConfig(API_URL_KEY);
	return url || DEFAULT_API_URL;
}

async function getProjectInfo(): Promise<{ name: string; editorType: 'Schematic' | 'PCB' | 'Project'; entity: string } | null> {
	try {
		const projectInfo = await eda.dmt_Project.getCurrentProjectInfo();
		if (!projectInfo) {
			eda.sys_Log.add(`[${TITLE}] Could not get project info`, ESYS_LogType.WARNING);
			return null;
		}

		let editorType: 'Schematic' | 'PCB' | 'Project' = 'Project';
		let entity = projectInfo.friendlyName;

		try {
			const schInfo = await eda.dmt_Schematic.getCurrentSchematicInfo();
			if (schInfo) {
				editorType = 'Schematic';
				entity = schInfo.name || projectInfo.friendlyName;
			}
			else {
				const pcbInfo = await eda.dmt_Pcb.getCurrentPcbInfo();
				if (pcbInfo) {
					editorType = 'PCB';
					entity = pcbInfo.name || projectInfo.friendlyName;
				}
			}
		}
		catch {
			// Fallback to Project type
		}

		return { name: projectInfo.friendlyName, editorType, entity };
	}
	catch (error) {
		eda.sys_Log.add(`[${TITLE}] Error getting project info: ${error}`, ESYS_LogType.ERROR);
		return null;
	}
}

async function getElementCount(editorType: 'Schematic' | 'PCB' | 'Project'): Promise<{ count: number; type: string }> {
	if (editorType === 'Schematic') {
		try {
			const count
				= (await eda.sch_PrimitiveComponent.getAll()).length
					+ (await eda.sch_PrimitiveWire.getAll()).length
					+ (await eda.sch_PrimitiveText.getAll()).length
					+ (await eda.sch_PrimitiveBus.getAll()).length
					+ (await eda.sch_PrimitivePin.getAll()).length;
			return { count, type: 'Schematic' };
		}
		catch {
			return { count: 0, type: 'Schematic' };
		}
	}
	else if (editorType === 'PCB') {
		try {
			const count
				= (await eda.pcb_PrimitiveComponent.getAll()).length
					+ (await eda.pcb_PrimitiveLine.getAll()).length
					+ (await eda.pcb_PrimitiveArc.getAll()).length
					+ (await eda.pcb_PrimitiveVia.getAll()).length
					+ (await eda.pcb_PrimitivePad.getAll()).length;
			return { count, type: 'PCB' };
		}
		catch {
			return { count: 0, type: 'PCB' };
		}
	}

	// Try schematic first, then PCB
	try {
		const schCount
			= (await eda.sch_PrimitiveComponent.getAll()).length
				+ (await eda.sch_PrimitiveWire.getAll()).length;
		if (schCount > 0)
			return { count: schCount, type: 'Schematic' };
	}
	catch { /* ignore */ }

	try {
		const pcbCount
			= (await eda.pcb_PrimitiveComponent.getAll()).length
				+ (await eda.pcb_PrimitiveLine.getAll()).length;
		if (pcbCount > 0)
			return { count: pcbCount, type: 'PCB' };
	}
	catch { /* ignore */ }

	return { count: 0, type: 'Project' };
}

async function assembleHeartbeat(projectInfo: { name: string; editorType: 'Schematic' | 'PCB' | 'Project'; entity: string }): Promise<Heartbeat[]> {
	const heartbeat: Heartbeat = {
		entity: `./${projectInfo.entity}`,
		type: 'file',
		category: 'designing',
		time: Date.now() / 1000,
		project: projectInfo.name,
		language: `EasyEDA ${projectInfo.editorType}`,
		is_write: true,
	};

	// Get element counts for line tracking
	const elementInfo = await getElementCount(projectInfo.editorType);
	const prevKey = projectInfo.editorType === 'PCB' ? PREVIOUS_PCB_COUNT_KEY : PREVIOUS_SCH_COUNT_KEY;
	const prevCountStr = await eda.sys_Storage.getExtensionUserConfig(prevKey);

	let prevCount = 0;
	if (prevCountStr && prevCountStr !== 'load') {
		prevCount = Number.parseInt(prevCountStr, 10) || 0;
	}
	else {
		prevCount = elementInfo.count;
	}

	heartbeat.lines = elementInfo.count;
	heartbeat.line_additions = Math.max(0, elementInfo.count - prevCount);
	heartbeat.line_deletions = Math.max(0, prevCount - elementInfo.count);
	heartbeat.language = `EasyEDA ${elementInfo.type}`;

	await eda.sys_Storage.setExtensionUserConfig(prevKey, elementInfo.count.toString());

	return [heartbeat];
}

async function sendHeartbeat(): Promise<void> {
	const apiKey = await eda.sys_Storage.getExtensionUserConfig(API_KEY_KEY);
	if (!apiKey)
		return;

	const projectInfo = await getProjectInfo();
	if (!projectInfo)
		return;

	const heartbeats = await assembleHeartbeat(projectInfo);
	const apiUrl = await getApiUrl();

	try {
		const response = await eda.sys_ClientUrl.request(
			`${apiUrl}/users/current/heartbeats.bulk`,
			'POST',
			JSON.stringify(heartbeats),
			{
				headers: {
					...COMMON_HEADERS,
					Authorization: `Bearer ${apiKey}`,
				},
			},
		);

		if (response.ok) {
			eda.sys_Log.add(`[${TITLE}] Heartbeat sent`, ESYS_LogType.INFO);
		}
		else {
			eda.sys_Log.add(`[${TITLE}] Heartbeat error: ${response.status}`, ESYS_LogType.ERROR);
		}
	}
	catch (error) {
		eda.sys_Log.add(`[${TITLE}] Heartbeat error: ${error}`, ESYS_LogType.ERROR);
	}
}

async function startHeartbeatLoop(): Promise<void> {
	while (true) {
		await new Promise(resolve => setTimeout(resolve, HEARTBEAT_INTERVAL));

		const lastEventStr = await eda.sys_Storage.getExtensionUserConfig(LAST_EVENT_TIME_KEY);
		if (!lastEventStr)
			continue;

		const lastEventTime = Number.parseInt(lastEventStr, 10);
		const timeDiff = Date.now() - lastEventTime;

		if (timeDiff <= INACTIVITY_TIMEOUT) {
			eda.sys_Log.add(`[${TITLE}] Activity detected, sending heartbeat`, ESYS_LogType.INFO);
			await sendHeartbeat();
		}
	}
}

async function initializeHackatime(): Promise<void> {
	const apiKey = await eda.sys_Storage.getExtensionUserConfig(API_KEY_KEY);

	if (!apiKey) {
		eda.sys_MessageBox.showInformationMessage(
			'Welcome to Hackatime! Please configure your API Key via Settings menu.',
			TITLE,
		);
	}

	// Reset element counts on load
	await eda.sys_Storage.setExtensionUserConfig(PREVIOUS_SCH_COUNT_KEY, 'load');
	await eda.sys_Storage.setExtensionUserConfig(PREVIOUS_PCB_COUNT_KEY, 'load');

	// Start heartbeat loop
	startHeartbeatLoop();
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported functions (menu handlers)
// ─────────────────────────────────────────────────────────────────────────────

export async function activate(): Promise<void> {
	eda.sys_Log.add(`[${TITLE}] Activated v${VERSION}`, ESYS_LogType.INFO);
	await initializeHackatime();
}

export async function openSettings(): Promise<void> {
	await eda.sys_IFrame.openIFrame('iframe/settings.html', 420, 280);
}

export async function showTodayStats(): Promise<void> {
	if (!await checkApiCredentials())
		return;

	try {
		const apiUrl = await getApiUrl();
		const apiKey = await eda.sys_Storage.getExtensionUserConfig(API_KEY_KEY);

		const response = await eda.sys_ClientUrl.request(
			`${apiUrl}/users/current/statusbar/today`,
			'GET',
			undefined,
			{
				headers: {
					...COMMON_HEADERS,
					Authorization: `Bearer ${apiKey}`,
				},
			},
		);

		if (response.ok) {
			const data = await response.json();
			let statsText = 'No activity recorded today.';

			if (data.data) {
				if (data.data.grand_total && data.data.grand_total.text) {
					statsText = `Today: ${data.data.grand_total.text}`;
				}
				else if (data.data.categories && data.data.categories.length > 0) {
					const parts = data.data.categories.map((c: { text: string; name: string }) => `${c.text} (${c.name})`);
					statsText = `Today: ${parts.join(', ')}`;
				}
			}

			eda.sys_MessageBox.showInformationMessage(statsText, TITLE);
		}
		else {
			eda.sys_Log.add(`[${TITLE}] Error fetching stats: ${response.status}`, ESYS_LogType.ERROR);
			eda.sys_MessageBox.showInformationMessage('Failed to fetch today\'s stats.', TITLE);
		}
	}
	catch (error) {
		eda.sys_Log.add(`[${TITLE}] Error fetching stats: ${error}`, ESYS_LogType.ERROR);
		eda.sys_MessageBox.showInformationMessage('Failed to fetch today\'s stats.', TITLE);
	}
}

export async function showAbout(): Promise<void> {
	eda.sys_MessageBox.showInformationMessage(
		`Hackatime v${VERSION}\nTrack your EasyEDA design time.\n\nVisit: https://hackatime.hackclub.com`,
		TITLE,
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event listener registration
// ─────────────────────────────────────────────────────────────────────────────

eda.pcb_Event.addMouseEventListener('mouseEvent', 'all', async () => {
	const now = Date.now();
	await eda.sys_Storage.setExtensionUserConfig(LAST_EVENT_TIME_KEY, now.toString());
});

// Auto-activate
activate();
