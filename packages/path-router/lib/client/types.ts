export type PathList = {
  [url: string]: string;
};

export type PathTreeNode = {
  [subroute: string]: PathTreeNode | string | undefined;
  '/'?: string;
};
