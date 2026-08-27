// Minimal test setup – no native module mocks needed here;
// individual test files mock what they use.

// Force Expo's lazily-installed globals (expo/src/winter/runtime.native.ts)
// to resolve eagerly here, inside the setup window. Jest 30's stricter
// between-test module-registry guard (`throwIfBetweenTests`) throws if the
// underlying `require()` behind one of these lazy getters is triggered
// later, from a leaked timer/microtask that fires between test files.
void global.__ExpoImportMetaRegistry;
void global.structuredClone;
