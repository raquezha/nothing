import path from "node:path";
import type { ArchitectureType } from "../types.js";

export function detectArchitectureType(files: string[]): { type: ArchitectureType; details: string } {
  const normFiles = files.map((f) => f.toLowerCase());

  const hasDomain = normFiles.some((f) => f.includes(`${path.sep}domain${path.sep}`) || f.includes(":domain"));
  const hasData = normFiles.some((f) => f.includes(`${path.sep}data${path.sep}`) || f.includes(":data"));
  const hasPresentation = normFiles.some((f) => f.includes(`${path.sep}presentation${path.sep}`) || f.includes(":presentation"));

  const useCaseFiles = normFiles.filter((f) => /usecase|interactor/i.test(path.basename(f)));
  const repositoryFiles = normFiles.filter((f) => /repository|gateway|port|adapter/i.test(path.basename(f)));
  const viewModelFiles = normFiles.filter((f) => /viewmodel|state|intent/i.test(path.basename(f)));

  const hasCleanCodePatterns = (useCaseFiles.length > 0 || repositoryFiles.length > 0) &&
    (hasPresentation || viewModelFiles.length > 0);

  if ((hasDomain && (hasData || hasPresentation)) || hasCleanCodePatterns || (useCaseFiles.length > 0 && repositoryFiles.length > 0)) {
    const details = useCaseFiles.length || repositoryFiles.length
      ? `Verified Clean Architecture via ${useCaseFiles.length} UseCase(s) and ${repositoryFiles.length} Repository/Gateway declaration(s)`
      : `Verified Clean Architecture via domain/data/presentation packages`;
    return { type: "CLEAN_ARCHITECTURE", details };
  }

  const hasDesignSystemModule = normFiles.some((f) =>
    f.includes(`${path.sep}designsystem${path.sep}`) ||
    f.includes(":designsystem") ||
    f.includes(`${path.sep}core${path.sep}ui${path.sep}`) ||
    /theme|designsystem/i.test(path.basename(f))
  );
  if (hasDesignSystemModule) {
    return { type: "DESIGN_SYSTEM_MODULE", details: "Verified Design System module (designsystem/core:ui/theme)" };
  }

  const hasFeatureByPackage = normFiles.some((f) =>
    f.includes(`${path.sep}feature${path.sep}`) ||
    f.includes(`${path.sep}features${path.sep}`) ||
    f.includes(":feature:")
  );
  if (hasFeatureByPackage) {
    return { type: "FEATURE_BY_PACKAGE", details: "Verified Feature-by-package structure (feature/*/)" };
  }

  const hasLayerByPackage = normFiles.some((f) =>
    f.includes(`${path.sep}screens${path.sep}`) ||
    f.includes(`${path.sep}viewmodels${path.sep}`) ||
    f.includes(`${path.sep}ui${path.sep}components${path.sep}`)
  );
  if (hasLayerByPackage) {
    return { type: "LAYER_BY_PACKAGE", details: "Verified Layer-by-package structure (screens/viewmodels/components)" };
  }

  return { type: "AD_HOC", details: "Ad-hoc / single-folder structure" };
}
