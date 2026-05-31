-- CreateTable
CREATE TABLE "qi_parameter_groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qi_parameter_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qi_parameters" (
    "id" TEXT NOT NULL,
    "parameter" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qi_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qi_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qi_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qi_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "numeric" BOOLEAN NOT NULL DEFAULT true,
    "formulaBased" BOOLEAN NOT NULL DEFAULT false,
    "value" VARCHAR(500),
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "acceptanceFormula" TEXT,

    CONSTRAINT "qi_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qi_parameter_groups_name_key" ON "qi_parameter_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "qi_parameters_parameter_key" ON "qi_parameters"("parameter");

-- CreateIndex
CREATE INDEX "qi_parameters_groupId_idx" ON "qi_parameters"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "qi_templates_name_key" ON "qi_templates"("name");

-- CreateIndex
CREATE INDEX "qi_template_items_templateId_idx" ON "qi_template_items"("templateId");

-- CreateIndex
CREATE INDEX "qi_template_items_parameterId_idx" ON "qi_template_items"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "qi_template_items_templateId_parameterId_key" ON "qi_template_items"("templateId", "parameterId");

-- AddForeignKey
ALTER TABLE "qi_parameters" ADD CONSTRAINT "qi_parameters_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "qi_parameter_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qi_template_items" ADD CONSTRAINT "qi_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "qi_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qi_template_items" ADD CONSTRAINT "qi_template_items_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "qi_parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
