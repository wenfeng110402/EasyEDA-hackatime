//定义所需的key IMPORTANT！！！！
const STORAGE_KEY_API_KEY = 'hackatime_api_key';
const STORAGE_KEY_PAUSED = 'hackatime_paused';
const STORAGE_KEY_CACHE = 'hackatime_cache';
const DEFAULT_API_URL = 'https://hackatime.hackclub.com/api/hackatime/v1';
const onNetworkOnline = () => flushCache();
const onUserKey = () => (lastActivityTime = Date.now());
const onUserMouse = () => (lastActivityTime = Date.now());

//2
let lastActivityTime = Date.now();
let heartbeatInterval: any = null;

//when activate
export function activate() {
	console.log('HackaTime extension activated');

	if(typeof window !== 'undefined') {
		window.addEventListener('mousedown', onUserMouse);
        window.addEventListener('keydown', onUserKey);
		window.addEventListener('online', onNetworkOnline);
	}

	//冲刷缓存的数据
	flushCache();

	startHeartbeatLoop();

}

//when deactivate
export function deactivate() {
	if(heartbeatInterval) {
		clearInterval(heartbeatInterval);
	}

	if(typeof window !== 'undefined') {
		window.removeEventListener('mousedown', onUserMouse);
		window.removeEventListener('keydown', onUserKey);
		window.removeEventListener('online', onNetworkOnline);
	}
}

export function showStats(){
	const apiUrl = localStorage.getItem('hackatime_api_url') || DEFAULT_API_URL;
	const dashboardUrl = apiUrl.split('/api/')[0];

	eda.sys_Dialog.showConfirmationMessage(
		'Open Hackatime Dashboard in your browser?',
		'Show Statistics',
		'Confirm',
		'Cancel',
		(confirmed: boolean) => {
			if (confirmed) window.open(dashboardUrl, '_blank');
		}
	)
}

export function help(){
	eda.sys_Dialog.showInformationMessage(
		'For help with Hackatime, please visit https://hackatime.hackclub.com/docs',
		'About Hackatime'
	);
}

export function openSettings() {
	const currentKey = localStorage.getItem(STORAGE_KEY_API_KEY) || '';

	eda.sys_Dialog.showInputDialog(
		'Hackatime API Key',
		undefined,
		'Set Hackatime API Key',
		'text',
		currentKey,
		{ placeholder: 'Enter your Hackatime API Key' },
		(value) => {
			if (value !== undefined && value !== null) {
				localStorage.setItem(STORAGE_KEY_API_KEY, String(value).trim());
				eda.sys_Dialog.showInformationMessage('API Key saved', 'Hackatime');
			}
		}
	);
}

export function toggle() {
	const isPaused = localStorage.getItem(STORAGE_KEY_PAUSED) === 'true';
	const nextState = !isPaused;
	localStorage.setItem(STORAGE_KEY_PAUSED, String(nextState));
	eda.sys_Dialog.showInformationMessage(
		`Hackatime Detect${nextState ? 'paused' : 'resumed'}`,
		'Hackatime'
	);
}

function startHeartbeatLoop() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
	}
	heartbeatInterval = setInterval(() => {
		sendHeartbeat();
	}, 2 * 60 * 1000);
}

async function sendHeartbeat() {
	const isPaused = localStorage.getItem(STORAGE_KEY_PAUSED) === 'true';
	if (isPaused) return;

	const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
	if (!apiKey) return;

	// 2分钟内无操作则不发送
	if (Date.now() - lastActivityTime > 2 * 60 * 1000) return;

	const projectInfo = await eda.dmt_Project.getCurrentProjectInfo();
	const docInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
	if (!projectInfo) return;

	const payload = {
		entity: docInfo?.uuid || 'unknown',
		type: 'file',
		category: 'designing',
		time: Math.floor(Date.now() / 1000),
		project: projectInfo.friendlyName || 'Unknown Project',
		language: String(docInfo?.documentType) === 'pcb' ? 'EasyEDA PCB' : 'EasyEDA Schematic',
		is_write: true
	};

	try {
		const res = await eda.sys_ClientUrl.request(
			`${DEFAULT_API_URL}/users/current/heartbeats`,
			'POST',
			JSON.stringify(payload),
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			}
		);

		if (!res || (res.status !== 200 && res.status !== 201)) {
			cacheHeartbeat(payload);
		} else {
			// 成功则尝试冲刷本地缓存
			flushCache();
		}
	} catch (e) {
		cacheHeartbeat(payload);
	}
}

function cacheHeartbeat(item: any) {
	try {
		const raw = localStorage.getItem(STORAGE_KEY_CACHE) || '[]';
		const arr = JSON.parse(raw);
		arr.push(item);
		// 限制最大缓存条数
		if (arr.length > 500) arr.shift();
		localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(arr));
	} catch (e) {
		// 忽略任何本地存储错误
	}
}

async function flushCache() {
	try {
		const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
		if (!apiKey) return;

		const raw = localStorage.getItem(STORAGE_KEY_CACHE);
		if (!raw) return;
		const arr = JSON.parse(raw);
		if (!Array.isArray(arr) || arr.length === 0) return;

		// 清空缓存区，若发送失败会重新入队
		localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify([]));

		for (const item of arr) {
			try {
				const res = await eda.sys_ClientUrl.request(
					`${DEFAULT_API_URL}/users/current/heartbeats`,
					'POST',
					JSON.stringify(item),
					{
						headers: {
							Authorization: `Bearer ${apiKey}`,
							'Content-Type': 'application/json'
						}
					}
				);

				if (!res || (res.status !== 200 && res.status !== 201)) {
					cacheHeartbeat(item);
				}
			} catch (e) {
				cacheHeartbeat(item);
				// 网络可能有问题，停止后续发送，留待下次重试
				break;
			}
		}
	} catch (e) {
		// 忽略
	}
}