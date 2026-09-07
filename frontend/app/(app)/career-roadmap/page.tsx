"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, Compass, FileSearch, Lightbulb, Map, Target } from "lucide-react";
import { api } from "@/lib/api";
import type { CareerRoadmap } from "@/lib/types";
import { PageHeader, LoadingSpinner } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CareerRoadmapPage() {
  const [roadmap, setRoadmap] = useState<CareerRoadmap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.careerRoadmap().then(setRoadmap).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!roadmap) return <p className="text-ocean-600">Unable to generate roadmap. Complete your profile first.</p>;

  const strengths = roadmap.current_strengths || [];
  const gaps = roadmap.skill_gaps || [];
  const actionPlan = (roadmap.action_plan || []).map((step) => ({
    ...step,
    actions: Array.isArray(step.actions)
      ? step.actions.map(String)
      : step.actions
        ? [String(step.actions)]
        : [],
  }));
  const routine = roadmap.weekly_routine || [];

  return (
    <>
      <PageHeader
        title="Career Roadmap"
        subtitle="A practical plan built from your profile, resume evidence, and active opportunities."
      />

      <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-ocean-800 via-ocean-700 to-emerald-800 text-white">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Map className="w-6 h-6" />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-emerald-200">Your target direction</p>
              <h2 className="font-display text-2xl font-semibold mb-2">{roadmap.career_goal}</h2>
              <p className="text-ocean-100 leading-relaxed">{roadmap.summary}</p>
            </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm lg:min-w-56">
              <div className="flex items-center gap-2 text-emerald-200"><FileSearch className="h-4 w-4" /> Resume signal</div>
              <p className="mt-1 font-medium">{roadmap.resume_analyzed ? "Included in this plan" : "Upload a resume for deeper guidance"}</p>
              {roadmap.resume_file_name && <p className="mt-1 truncate text-xs text-ocean-200">{roadmap.resume_file_name}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-gold-600" /> Current signal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-ocean-600">Strengths detected from your profile and resume.</p>
            {strengths.length ? <div className="flex flex-wrap gap-2">{strengths.map((strength) => <Badge key={strength} variant="ocean" className="normal-case tracking-normal"><CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />{strength}</Badge>)}</div> : <p className="text-sm text-ocean-500">Add skills to your profile or upload a text-readable resume to build your signal.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-gold-600" /> Weekly rhythm</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">{routine.map((item, index) => <li key={index} className="flex gap-2 text-sm text-ocean-700"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold-500" />{item}</li>)}</ul>
          </CardContent>
        </Card>
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h2 className="font-display text-2xl font-semibold text-ocean-950">Skills to close next</h2><p className="mt-1 text-sm text-ocean-600">Prioritized gaps with a concrete way to learn each one.</p></div>
          <BookOpen className="hidden h-7 w-7 text-ocean-300 sm:block" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gaps.map((gap, index) => <Card key={`${gap.skill}-${index}`} className="border-ocean-100"><CardContent className="pt-5"><div className="mb-3 flex items-start justify-between gap-3"><h3 className="font-semibold text-ocean-900">{gap.skill}</h3><Badge variant={gap.priority === "high" ? "gold" : "default"} className="normal-case tracking-normal">{gap.priority || "next"}</Badge></div><p className="text-sm text-ocean-600">{gap.why}</p><div className="mt-4 rounded-lg bg-ocean-50 p-3 text-sm text-ocean-800"><span className="font-medium">How to learn:</span> {gap.how_to_learn}</div></CardContent></Card>)}
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4"><h2 className="font-display text-2xl font-semibold text-ocean-950">Your execution plan</h2><p className="mt-1 text-sm text-ocean-600">Turn learning into evidence that strengthens future applications.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          {actionPlan.map((step, index) => <Card key={`${step.title}-${index}`}><CardContent className="pt-5"><div className="flex gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean-700 text-sm font-semibold text-white">{index + 1}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ocean-900">{step.title}</h3>{step.timeframe && <Badge variant="ocean" className="normal-case tracking-normal">{step.timeframe}</Badge>}</div><ul className="mt-3 space-y-2">{(step.actions || []).map((action, actionIndex) => <li key={actionIndex} className="flex gap-2 text-sm text-ocean-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{action}</li>)}</ul>{step.proof && <p className="mt-4 border-t border-ocean-100 pt-3 text-xs text-ocean-500"><span className="font-semibold text-ocean-700">Proof to produce:</span> {step.proof}</p>}</div></div></CardContent></Card>)}
        </div>
      </section>

      <div className="relative">
        <div className="mb-4"><h2 className="font-display text-2xl font-semibold text-ocean-950">Long-term milestones</h2><p className="mt-1 text-sm text-ocean-600">A sequence of outcomes, not just a list of courses.</p></div>
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-ocean-400 via-gold-400 to-sand-300 hidden sm:block" />

        <div className="space-y-8">
          {roadmap.years.map((year, i) => (
            <div key={i} className="relative sm:pl-16 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="hidden sm:flex absolute left-4 top-6 w-5 h-5 rounded-full bg-ocean-700 border-4 border-sand-50 items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gold-400" />
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Badge variant="gold" className="normal-case tracking-normal"><CalendarDays className="mr-1 h-3.5 w-3.5" />
                      Year {year.year}
                    </Badge>
                    <CardTitle>{year.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-ocean-800 mb-2">Milestones</h4>
                      <ul className="space-y-2">
                        {(year.milestones || []).map((m, j) => (
                            <li key={j} className="text-sm text-ocean-700 flex gap-2">
                              <span className="text-gold-500 shrink-0">◆</span>
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-ocean-800 mb-2">Skills to Develop</h4>
                      <div className="flex flex-wrap gap-2">
                        {(year.skills_to_develop || []).map((s, j) => (
                          <Badge key={j} variant="ocean" className="normal-case tracking-normal">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {roadmap.linked_opportunity_ids?.length > 0 && (
        <div className="mt-10">
          <h3 className="font-display text-lg font-semibold text-ocean-900 mb-4 flex items-center gap-2">
            <Compass className="w-5 h-5" />
            Linked Opportunities
          </h3>
          <div className="flex flex-wrap gap-2">
            {roadmap.linked_opportunity_ids.map((id) => (
              <Link key={id} href={`/opportunities/${id}`}>
                <Badge variant="default" className="normal-case tracking-normal cursor-pointer hover:bg-ocean-50">
                  {id}<ArrowUpRight className="ml-1 h-3 w-3" />
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
