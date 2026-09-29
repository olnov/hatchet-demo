ALTER TABLE "Info" ADD COLUMN "personId" TEXT NOT NULL;

CREATE UNIQUE INDEX "Info_personId_key" ON "Info"("personId");

CREATE TABLE "ProfileLink" (
    "token" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileLink_pkey" PRIMARY KEY ("token")
);

CREATE UNIQUE INDEX "ProfileLink_personId_key" ON "ProfileLink"("personId");
