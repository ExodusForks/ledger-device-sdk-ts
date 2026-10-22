import { ContainerModule } from "inversify";

import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";
import { GetMasterFingerprintUseCase } from "@internal/use-cases/get-master-fingerprint/GetMasterFingerprintUseCase";
import { GetWalletAddressUseCase } from "@internal/use-cases/get-wallet-address/GetWalletAddressUseCase";
import { RegisterWalletUseCase } from "@internal/use-cases/register-wallet/RegisterWalletUseCase";
import { SignPsbtUseCase } from "@internal/use-cases/sign-psbt/SignPsbtUseCase";

export const useCasesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(useCasesTypes.GetExtendedPublicKeyUseCase).to(
      GetExtendedPublicKeyUseCase,
    );
    bind(useCasesTypes.GetMasterFingerprintUseCase).to(
      GetMasterFingerprintUseCase,
    );
    bind(useCasesTypes.RegisterWalletUseCase).to(RegisterWalletUseCase);
    bind(useCasesTypes.SignPsbtUseCase).to(SignPsbtUseCase);
    bind(useCasesTypes.GetWalletAddressUseCase).to(GetWalletAddressUseCase);
  });
