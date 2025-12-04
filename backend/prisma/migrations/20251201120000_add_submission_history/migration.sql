-- CreateTable
CREATE TABLE "SubmissionHistory" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerFileId" TEXT,
    "answerType" "AnswerType" NOT NULL DEFAULT 'TEXT',
    "aiScore" DOUBLE PRECISION,
    "aiFeedback" TEXT,
    "curatorScore" DOUBLE PRECISION,
    "curatorFeedback" TEXT,
    "status" "SubmissionStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionHistory_submissionId_idx" ON "SubmissionHistory"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionHistory_createdAt_idx" ON "SubmissionHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "SubmissionHistory" ADD CONSTRAINT "SubmissionHistory_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

