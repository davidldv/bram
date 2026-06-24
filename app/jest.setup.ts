// react-native-safe-area-context ships a jest mock so SafeAreaView/useSafeAreaInsets
// render with default insets without a real provider. The v5 mock is a default
// export, so unwrap `.default` for named imports to resolve.
jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

export {};
