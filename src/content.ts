import { RegexService } from './content/RegexService';
import { TitleService } from './content/TitleService';
import { IconService } from './content/IconService';
import { StorageService } from './content/StorageService';
import { RuleApplicationService } from './content/RuleApplicationService';
import { SpotSearchUI } from './content/SpotSearchUI';
import { UrlChangeDetector } from './content/UrlChangeDetector';

import {
	debugLog,
	initDebugMode,
} from './content/debugLog';

// ============================================================
// Types
// ============================================================

enum RuntimeAction {
	OPEN_PROMPT = 'openPrompt',
	APPLY_RULE = 'applyRule',
	UNGROUP_TAB = 'ungroupTab',
	TOGGLE_SPOT_SEARCH = 'toggleSpotSearch',
	SPOT_SEARCH_RESULTS = 'spotSearchResults',
	RENAME_TAB = 'renameTab',
}

interface SpotSearchTab {
	id: number;
	title: string;
	url: string;
	favIconUrl?: string;
}

interface SpotSearchBookmark {
	id: string;
	title: string;
	url?: string;
}

interface ApplyRuleMessage {
	action: RuntimeAction.APPLY_RULE;
	rule: unknown;
}

interface UngroupTabMessage {
	action: RuntimeAction.UNGROUP_TAB;
	tabId: number;
}

interface SpotSearchResultsMessage {
	action: RuntimeAction.SPOT_SEARCH_RESULTS;
	tabs: SpotSearchTab[];
	bookmarks: SpotSearchBookmark[];
}

type RuntimeMessage =
	| {
			action: RuntimeAction.OPEN_PROMPT;
	  }
	| ApplyRuleMessage
	| UngroupTabMessage
	| {
			action: RuntimeAction.TOGGLE_SPOT_SEARCH;
	  }
	| SpotSearchResultsMessage;

// ============================================================
// Content Application
// ============================================================

class ContentApp {
	private initialized = false;

	private readonly regexService = new RegexService();

	private readonly titleService =
		new TitleService(this.regexService);

	private readonly iconService =
		new IconService();

	private readonly storageService =
		new StorageService(this.regexService);

	private readonly ruleService =
		new RuleApplicationService(
			this.titleService,
			this.iconService
		);

	private readonly spotSearchUI =
		new SpotSearchUI();

	private readonly urlDetector =
		new UrlChangeDetector();

	private readonly messageHandler = (
		request: RuntimeMessage
	): boolean => {
		void this.handleMessage(request);

		return true;
	};

	// ========================================================
	// Initialization
	// ========================================================

	async initialize(): Promise<void> {
		if (this.initialized) return;

		this.initialized = true;

		try {
			await this.initializeDebugMode();

			this.initializeSpotSearch();

			this.setupUrlDetection();

			this.setupMessageListeners();

			await this.applyRules(location.href);

			debugLog(
				'[Tabee:Content] ✅ Initialized'
			);

		} catch (error) {
			console.error(
				'[Tabee:Content] Initialization failed:',
				error
			);
		}
	}

	private async initializeDebugMode(): Promise<void> {
		await initDebugMode();

		debugLog(
			'[Tabee:Debug] 🛠 Debug mode initialized'
		);
	}

	private initializeSpotSearch(): void {
		try {
			this.spotSearchUI.init();

			debugLog(
				'[Tabee:Search] 🔍 Spot Search initialized'
			);

		} catch (error) {
			console.error(
				'[Tabee:Search] Initialization failed:',
				error
			);
		}
	}

	// ========================================================
	// URL Detection
	// ========================================================

	private setupUrlDetection(): void {
		this.urlDetector.onChange(
			async (newUrl, oldUrl) => {
				debugLog(
					'[Tabee:Router] 🔄 URL changed',
					{
						oldUrl,
						newUrl,
					}
				);

				await this.applyRules(newUrl);
			}
		);

		this.urlDetector.start();
	}

	// ========================================================
	// Rule Handling
	// ========================================================

	private async applyRules(
		url: string
	): Promise<void> {
		try {
			const rule =
				await this.storageService.getRuleFromUrl(
					url
				);

			if (!rule) {
				debugLog(
					'[Tabee:Rules] No matching rule found'
				);

				return;
			}

			debugLog(
				'[Tabee:Rules] 📋 Applying rule',
				url
			);

			await this.ruleService.applyRule(rule);

		} catch (error) {
			console.error(
				'[Tabee:Rules] Failed applying rule:',
				error
			);
		}
	}

	// ========================================================
	// Messaging
	// ========================================================

	private setupMessageListeners(): void {
		chrome.runtime.onMessage.addListener(
			this.messageHandler
		);
	}

	private async handleMessage(
		request: RuntimeMessage
	): Promise<void> {
		try {
			switch (request.action) {
				case RuntimeAction.OPEN_PROMPT:
					await this.handleOpenPrompt();
					break;

				case RuntimeAction.APPLY_RULE:
					await this.ruleService.applyRule(
						request.rule,
						false
					);
					break;

				case RuntimeAction.UNGROUP_TAB:
					await chrome.tabs.ungroup(
						request.tabId
					);
					break;

				case RuntimeAction.TOGGLE_SPOT_SEARCH:
					this.toggleSpotSearch();
					break;

				case RuntimeAction.SPOT_SEARCH_RESULTS:
					this.showSpotSearchResults(
						request.tabs,
						request.bookmarks
					);
					break;

				default:
					debugLog(
						'[Tabee:Messages] Unknown message',
						request
					);
			}

		} catch (error) {
			console.error(
				'[Tabee:Messages] Failed handling message:',
				error
			);
		}
	}

	// ========================================================
	// Actions
	// ========================================================

	private async handleOpenPrompt(): Promise<void> {
		const title = prompt(
			'Enter the new tab title'
		);

		if (!title?.trim()) return;

		await chrome.runtime.sendMessage({
			action: RuntimeAction.RENAME_TAB,
			title: title.trim(),
		});
	}

	private toggleSpotSearch(): void {
		debugLog(
			'[Tabee:Search] 🔍 Toggling Spot Search'
		);

		this.spotSearchUI.toggle();
	}

	private showSpotSearchResults(
		tabs: SpotSearchTab[],
		bookmarks: SpotSearchBookmark[]
	): void {
		debugLog(
			'[Tabee:Search] 📑 Rendering search results',
			{
				tabs: tabs.length,
				bookmarks: bookmarks.length,
			}
		);

		this.spotSearchUI.displayResults(
			tabs,
			bookmarks
		);
	}

	// ========================================================
	// Cleanup
	// ========================================================

	destroy(): void {
		chrome.runtime.onMessage.removeListener(
			this.messageHandler
		);

		this.urlDetector.stop?.();

		debugLog(
			'[Tabee:Content] 🧹 Destroyed'
		);
	}
}

// ============================================================
// Bootstrap
// ============================================================

const app = new ContentApp();

void app.initialize();

window.addEventListener('beforeunload', () => {
	app.destroy();
});
