<template>
	<div class="min-w-[400px] max-w-[400px] max-h-[400px] overflow-auto p-4">
		<RuleForm
			v-if="isInit"
			:rule="rule"
			:options="{ showCancel: false, showTitle: true, showOptionLink: true }"
			@on-save="reloadTab"
		/>
	</div>
</template>

<script setup lang="ts">
import { useRulesStore } from './stores/rules.store.ts';
import { onMounted, ref } from 'vue';
import RuleForm from './components/options/center/sections/TabRules/RuleForm.vue';
import { _getDefaultRule, _getRuleFromUrl } from './common/storage.ts';

const rulesStore = useRulesStore();

const isInit = ref(false);
const rule = ref(_getDefaultRule('', '', 'url'));
const tab = ref<chrome.tabs.Tab | null>(null);

/* =========================
   Helpers
========================= */
const reloadTab = () => {
	if (!tab.value?.id) return;
	chrome.tabs.reload(tab.value.id);
};

/* =========================
   Tab Update Listener
========================= */
const handleTabUpdate = async (_: number, changeInfo: chrome.tabs.TabChangeInfo) => {
	if (!changeInfo.url) return;

	const foundRule = await _getRuleFromUrl(changeInfo.url);
	if (!foundRule) return;

	rule.value = foundRule;
	rulesStore.currentRule = foundRule;
};

chrome.tabs.onUpdated.addListener(handleTabUpdate);

/* =========================
   Init
========================= */
onMounted(async () => {
	await rulesStore.init();

	const tabs = await chrome.tabs.query({
		active: true,
		lastFocusedWindow: true,
	});

	if (!tabs.length) {
		isInit.value = true;
		return;
	}

	tab.value = tabs[0];

	if (!tab.value?.url) {
		isInit.value = true;
		return;
	}

	const foundRule = await _getRuleFromUrl(tab.value.url);

	if (foundRule) {
		rule.value = foundRule;
		rulesStore.currentRule = foundRule;
	} else {
		rule.value.url_fragment = tab.value.url;
	}

	isInit.value = true;
});
</script>
