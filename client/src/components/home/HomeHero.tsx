import { useState, type FormEvent } from "react";
import type { PublicUser } from "@findbarber/shared/types";
import { resolveUploadUrl } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";

interface HomeHeroProps {
  user: PublicUser | null;
  /** Reçoit la ville (non trimée) : la navigation est décidée par la page. */
  onSubmitCity: (city: string) => void;
}

function greetingFor(user: PublicUser | null): string {
  const firstName = user?.name?.trim().split(/\s+/)[0];
  return firstName ? `Bonjour, ${firstName}.` : "Bienvenue sur FindBarber.";
}

export function HomeHero({ user, onSubmitCity }: HomeHeroProps) {
  const [city, setCity] = useState("");

  const initialSource = user?.name?.trim() || user?.email || "";
  const initial = initialSource.charAt(0).toUpperCase();
  const avatarUrl = user?.avatarPath ? resolveUploadUrl(user.avatarPath) : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmitCity(city);
  }

  return (
    <Card className="relative overflow-hidden p-6 sm:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent-soft"
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent"
            >
              {initial}
            </span>
          )}
          <p className="text-sm font-medium text-foreground-muted">
            {greetingFor(user)}
          </p>
        </div>

        <h1 className="mt-5 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Trouvez votre barber, au bon moment.
        </h1>
        <p className="mt-3 text-base text-foreground-muted">
          Réservez en quelques instants, au salon ou à domicile.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Field label="Ville" className="min-w-0 flex-1">
            {(control) => (
              <Input
                {...control}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Dans quelle ville cherchez-vous ?"
                autoComplete="address-level2"
                className="min-h-[44px]"
              />
            )}
          </Field>
          <Button
            type="submit"
            className="min-h-[44px] w-full sm:w-auto sm:shrink-0"
          >
            Rechercher
          </Button>
        </form>
      </div>
    </Card>
  );
}
