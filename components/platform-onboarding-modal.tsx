"use client";

import { useMemo, useState } from "react";

import { useLanguage } from "@/lib/language-context";

type AccountType = "cliente" | "negocio";

type PlatformOnboardingModalProps = {
  accountType: AccountType;
  onClose: () => void;
};

export default function PlatformOnboardingModal({ accountType, onClose }: PlatformOnboardingModalProps) {
  const isClient = accountType === "cliente";
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useLanguage();

  const steps = useMemo(
    () =>
      isClient
        ? [
            {
              title: t("onboarding.client.step1.title"),
              description: t("onboarding.client.step1.desc"),
            },
            {
              title: t("onboarding.client.step2.title"),
              description: t("onboarding.client.step2.desc"),
            },
            {
              title: t("onboarding.client.step3.title"),
              description: t("onboarding.client.step3.desc"),
            },
            {
              title: t("onboarding.client.step4.title"),
              description: t("onboarding.client.step4.desc"),
            },
          ]
        : [
            {
              title: t("onboarding.business.step1.title"),
              description: t("onboarding.business.step1.desc"),
            },
            {
              title: t("onboarding.business.step2.title"),
              description: t("onboarding.business.step2.desc"),
            },
            {
              title: t("onboarding.business.step3.title"),
              description: t("onboarding.business.step3.desc"),
            },
            {
              title: t("onboarding.business.step4.title"),
              description: t("onboarding.business.step4.desc"),
            },
          ],
    [isClient],
  );

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goNext = () => {
    if (isLastStep) {
      onClose();
      return;
    }

    setCurrentStep((value) => value + 1);
  };

  const goBack = () => {
    if (isFirstStep) {
      return;
    }

    setCurrentStep((value) => value - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">{t("onboarding.header")}</p>
        <h2 className="mt-2 text-3xl font-black text-[#151138]">
          {isClient ? t("onboarding.title.client") : t("onboarding.title.business")}
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          {isClient ? t("onboarding.subtitle.client") : t("onboarding.subtitle.business")}
        </p>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("onboarding.step")} {currentStep + 1} {t("onboarding.of")} {steps.length}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
            >
              {t("onboarding.skip")}
            </button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-5">
          <StepCard title={`${currentStep + 1}) ${step.title}`} description={step.description} />
        </div>

        <div className="mt-7 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-indigo-800">
          {t("onboarding.tip")}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirstStep}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("onboarding.previous")}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-xl bg-[#130b3a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#231365]"
          >
            {isLastStep ? t("onboarding.done") : t("onboarding.next")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}
