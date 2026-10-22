import * as api from "./index";

describe("Exodus device-management API", () => {
  it("keeps session, app and certificate operations", () => {
    for (const name of [
      "DeviceManagementKitBuilder",
      "GetDeviceStatusDeviceAction",
      "ListAppsDeviceAction",
      "OpenAppDeviceAction",
      "CloseAppCommand",
      "GetAppAndVersionCommand",
      "LoadCertificateCommand",
    ]) {
      expect(api).toHaveProperty(name, expect.any(Function));
    }
  });

  it("does not export unused app-management convenience actions", () => {
    expect(api).not.toHaveProperty("OpenAppWithDependenciesDeviceAction");
    expect(api).not.toHaveProperty("ListAppsWithMetadataDeviceAction");
  });
});
