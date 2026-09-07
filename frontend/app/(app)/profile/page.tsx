"use client";

import { useEffect, useState } from "react";
import { FileText, Save, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { Document, Profile } from "@/lib/types";
import { PageHeader, LoadingSpinner } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DOCUMENT_TYPES = [
  { value: "transcript", label: "Marksheet / Transcript" },
  { value: "income_certificate", label: "Income Certificate" },
  { value: "caste_certificate", label: "Caste / Community Certificate" },
  { value: "bank_passbook", label: "Bank Passbook" },
  { value: "aadhaar", label: "Aadhaar / Identity Proof" },
  { value: "passport_photo", label: "Passport Photo" },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentType, setDocumentType] = useState("transcript");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Promise.all([api.getProfile(), api.documents()])
      .then(([profileData, documentData]) => {
        setProfile(profileData);
        setDocuments(documentData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const uploadDocument = async (file: File, type: string) => {
    setUploading(true);
    setMessage("");
    try {
      const uploaded = await api.uploadDocument(type, file);
      setDocuments((current) => [uploaded, ...current]);
      setMessage(`${type === "resume" ? "Resume" : "Document"} uploaded successfully`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Document upload failed");
    } finally {
      setUploading(false);
    }
  };

  const update = (field: keyof Profile, value: unknown) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await api.updateProfile({
        degree: profile.degree,
        field_of_study: profile.field_of_study,
        institution: profile.institution,
        gpa: profile.gpa,
        graduation_year: profile.graduation_year,
        country: profile.country,
        state: profile.state,
        city: profile.city,
        skills: profile.skills,
        interests: profile.interests,
        career_goals: profile.career_goals,
        education_level: profile.education_level,
        category: profile.category,
      });
      setProfile(updated);
      setMessage("Profile saved successfully");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!profile) return <p className="text-ocean-600">Profile not found.</p>;

  return (
    <>
      <PageHeader
        title="Your Profile"
        subtitle="Help EduPath AI understand your background to find the best matches."
        action={
          <Button onClick={save} loading={saving}>
            <Save className="w-4 h-4" />
            Save Profile
          </Button>
        }
      />

      {message && (
        <p className="mb-4 text-sm text-ocean-700 bg-ocean-50 rounded-lg px-4 py-2">{message}</p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Education</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Degree</Label>
              <Input value={profile.degree || ""} onChange={(e) => update("degree", e.target.value)} placeholder="Bachelor of Science" />
            </div>
            <div>
              <Label>Field of Study</Label>
              <Input value={profile.field_of_study || ""} onChange={(e) => update("field_of_study", e.target.value)} placeholder="Computer Science" />
            </div>
            <div>
              <Label>Institution</Label>
              <Input value={profile.institution || ""} onChange={(e) => update("institution", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>GPA</Label>
                <Input type="number" step="0.01" value={profile.gpa ?? ""} onChange={(e) => update("gpa", e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div>
                <Label>Graduation Year</Label>
                <Input type="number" value={profile.graduation_year ?? ""} onChange={(e) => update("graduation_year", e.target.value ? parseInt(e.target.value) : null)} />
              </div>
            </div>
            <div>
              <Label>Education Level</Label>
              <Input value={profile.education_level || ""} onChange={(e) => update("education_level", e.target.value)} placeholder="Undergraduate" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Country</Label>
              <Input value={profile.country || ""} onChange={(e) => update("country", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State</Label>
                <Input value={profile.state || ""} onChange={(e) => update("state", e.target.value)} />
              </div>
              <div>
                <Label>City</Label>
                <Input value={profile.city || ""} onChange={(e) => update("city", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={profile.category || ""} onChange={(e) => update("category", e.target.value)} placeholder="General / SC / ST / OBC" />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Skills, Interests & Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Skills (comma-separated)</Label>
              <Textarea
                value={(profile.skills || []).join(", ")}
                onChange={(e) => update("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="Python, Machine Learning, Research"
              />
            </div>
            <div>
              <Label>Interests (comma-separated)</Label>
              <Textarea
                value={(profile.interests || []).join(", ")}
                onChange={(e) => update("interests", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              />
            </div>
            <div>
              <Label>Career Goals (comma-separated)</Label>
              <Textarea
                value={(profile.career_goals || []).join(", ")}
                onChange={(e) => update("career_goals", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Required Documents</CardTitle>
            <p className="text-sm text-ocean-600">
              Upload your resume first. Supporting documents improve scholarship eligibility and application readiness.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div>
                    <p className="font-medium text-ocean-900">Resume / CV <span className="text-red-600">*</span></p>
                    <p className="text-xs text-ocean-600 mt-1">Required for personalized recommendations and resume analysis.</p>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-ocean-700 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-800">
                  <Upload className="h-4 w-4" />
                  {documents.some((document) => document.document_type === "resume") ? "Replace resume" : "Upload resume"}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.txt,.md"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadDocument(file, "resume");
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              {documents.some((document) => document.document_type === "resume") && (
                <p className="mt-3 text-xs font-medium text-emerald-700">Resume uploaded</p>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ocean-900">Supporting documents <span className="text-xs font-normal text-ocean-500">(optional)</span></p>
                  <p className="text-xs text-ocean-600 mt-1">Add only documents that belong to you and match your profile.</p>
                </div>
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="h-10 rounded-xl border border-ocean-200 bg-white px-3 text-sm"
                  aria-label="Supporting document type"
                >
                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ocean-300 bg-ocean-50/50 px-4 py-4 text-sm font-medium text-ocean-700 hover:bg-ocean-50">
                <Upload className="h-4 w-4" />
                Upload selected supporting document
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadDocument(file, documentType);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            {documents.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-ocean-100 pt-4">
                {documents.map((document) => (
                  <span key={document.id} className="rounded-full bg-ocean-50 px-3 py-1.5 text-xs text-ocean-700">
                    {document.document_type.replace(/_/g, " ")}: {document.file_name}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
