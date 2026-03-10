-- CreateTable
CREATE TABLE "vote_predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "motion_id" UUID NOT NULL,
    "algorithm_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "party_predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vote_prediction_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "predicted_vote" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rationale" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "party_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vote_predictions_motion_id_algorithm_version_key" ON "vote_predictions"("motion_id", "algorithm_version");

-- CreateIndex
CREATE UNIQUE INDEX "party_predictions_vote_prediction_id_party_id_key" ON "party_predictions"("vote_prediction_id", "party_id");

-- AddForeignKey
ALTER TABLE "vote_predictions" ADD CONSTRAINT "vote_predictions_motion_id_fkey" FOREIGN KEY ("motion_id") REFERENCES "motions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_predictions" ADD CONSTRAINT "party_predictions_vote_prediction_id_fkey" FOREIGN KEY ("vote_prediction_id") REFERENCES "vote_predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_predictions" ADD CONSTRAINT "party_predictions_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
