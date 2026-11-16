import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  TextInput,
} from "@patternfly/react-core";
import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { NetworkError, createClient } from "../api/client";
import { AnimatedTitle, Logo } from "../components/Logo";
import { useSession } from "../context/SessionContext";
import { DEFAULT_SERVER } from "../context/storage";
import { normalizeServerUrl } from "../utils/url";

/** Step 1: choose the Agama server and check that it is reachable. */
export function ServerPage() {
  const { serverUrl, token, recentServers, setServer } = useSession();
  const navigate = useNavigate();
  const [value, setValue] = useState(serverUrl ?? recentServers[0] ?? DEFAULT_SERVER);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalized = normalizeServerUrl(value);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }
    setValue(normalized.url);

    setConnecting(true);
    try {
      await createClient({ baseUrl: normalized.url }).ping();
      const alreadyLoggedIn = !!token && normalized.url === serverUrl;
      setServer(normalized.url);
      navigate(alreadyLoggedIn ? "/products" : "/login");
    } catch (e) {
      if (e instanceof NetworkError) {
        // most likely an untrusted certificate, the user has to accept it first
        setServer(normalized.url);
        navigate("/trust");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="page page--narrow">
      <div className="hero">
        <Logo />
        <AnimatedTitle text="Welcome to Agama" />
        <motion.p
          className="subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Pick the installer you want to talk to.
        </motion.p>
      </div>

      <Form onSubmit={(e) => void connect(e)}>
        <FormGroup label="Agama server" fieldId="server-url">
          <TextInput
            id="server-url"
            type="text"
            value={value}
            onChange={(_e, v) => setValue(v)}
            placeholder={DEFAULT_SERVER}
            list="recent-servers"
            autoFocus
            isDisabled={connecting}
          />
          <datalist id="recent-servers">
            {recentServers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <HelperText>
            <HelperTextItem>
              Only HTTPS is supported, the server certificate is usually self-signed.
            </HelperTextItem>
          </HelperText>
        </FormGroup>

        {error && <Alert variant="danger" isInline title={error} />}

        <ActionGroup>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={connecting}
            isDisabled={connecting}
          >
            {connecting ? "Connecting…" : "Connect"}
          </Button>
        </ActionGroup>
      </Form>
    </div>
  );
}
