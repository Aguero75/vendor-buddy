import { auth } from "@clerk/nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";

const upload = createUploadthing();

export const ourFileRouter = {
  logoUploader: upload({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const { userId } = await auth();

      if (!userId) {
        throw new Error("You must be signed in to upload a logo.");
      }

      return { userId };
    })
    .onUploadComplete(async ({ file }) => ({
      url: file.ufsUrl,
    })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
