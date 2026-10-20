import config, {
  nodeRuntimeOverrides,
} from "../packages/config/eslint/index.js";

export default [...config, ...nodeRuntimeOverrides];
