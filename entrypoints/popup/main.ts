import { mount } from "svelte";
import "../../styles/base.css";
import { followTheme } from "../../lib/theme";
import Popup from "./Popup.svelte";

followTheme();
mount(Popup, { target: document.getElementById("app")! });
