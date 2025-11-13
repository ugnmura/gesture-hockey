import { BASE_PATH } from "@/utils/constants";

export const getURL = (path: string): string => {
  if (!BASE_PATH) {
    return path;
  }
  return BASE_PATH + path;
};
