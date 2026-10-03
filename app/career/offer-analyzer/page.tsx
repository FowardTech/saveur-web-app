import { redirect } from "next/navigation";

// Offer Analyzer is merged into Salary Benchmark ("A job offer" mode).
export default function OfferAnalyzerRedirect() {
  redirect("/career/salary-benchmark?kind=offer");
}
